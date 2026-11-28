#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;
pub mod utils;
pub mod validation;

use constants::{PRIMARY_PLATFORM_FEE_BPS, RESALE_ARTIST_FEE_BPS, RESALE_PLATFORM_FEE_BPS};
use errors::EncoreError;
use events::SupportReceiptEvent;
use state::*;
use utils::fee_math::compute_bps_fee;
use validation::{assert_pass_non_terminal, assert_passport_eligible};

declare_id!("11111111111111111111111111111111");

#[program]
pub mod encore {
    use super::*;

    pub fn register_artist(
        ctx: Context<RegisterArtist>,
        payout_wallet: Pubkey,
        profile_hash: [u8; 32],
    ) -> Result<()> {
        let artist = &mut ctx.accounts.artist;
        artist.artist_authority = ctx.accounts.authority.key();
        artist.payout_wallet = payout_wallet;
        artist.profile_hash = profile_hash;
        artist.bump = ctx.bumps.artist;
        Ok(())
    }

    pub fn register_track(
        ctx: Context<RegisterTrack>,
        track_id_hash: [u8; 32],
        manifest_hash: [u8; 32],
        origin_enum: u8,
        evidence_enum: u8,
        rights_flags: u8,
    ) -> Result<()> {
        let track = &mut ctx.accounts.track;
        track.artist = ctx.accounts.artist.key();
        track.track_id_hash = track_id_hash;
        track.current_version = 1;
        track.current_manifest_hash = manifest_hash;
        track.paused = false;
        track.bump = ctx.bumps.track;

        let pv = &mut ctx.accounts.passport_version;
        pv.track = track.key();
        pv.version = 1;
        pv.previous_hash = [0u8; 32];
        pv.manifest_hash = manifest_hash;
        pv.origin_enum = origin_enum;
        pv.evidence_enum = evidence_enum;
        pv.rights_flags = rights_flags;
        pv.reviewer = Pubkey::default();
        pv.recorded_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn direct_support(
        ctx: Context<DirectSupport>,
        nonce: u64,
        expected_version: u32,
        expected_manifest_hash: [u8; 32],
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, EncoreError::InvalidAmount);
        assert_passport_eligible(
            &ctx.accounts.track,
            expected_version,
            expected_manifest_hash,
        )?;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.payer_ata.to_account_info(),
                    to: ctx.accounts.artist_ata.to_account_info(),
                    authority: ctx.accounts.payer.to_account_info(),
                },
            ),
            amount,
        )?;

        let receipt = &mut ctx.accounts.support_receipt;
        receipt.payer = ctx.accounts.payer.key();
        receipt.nonce = nonce;
        receipt.track = ctx.accounts.track.key();
        receipt.version = expected_version;
        receipt.manifest_hash = expected_manifest_hash;
        receipt.amount = amount;
        receipt.recipient = ctx.accounts.artist.payout_wallet;
        receipt.bump = ctx.bumps.support_receipt;

        emit!(SupportReceiptEvent {
            payer: receipt.payer,
            track: receipt.track,
            version: receipt.version,
            manifest_hash: receipt.manifest_hash,
            amount,
            recipient: receipt.recipient,
            nonce,
        });
        Ok(())
    }

    pub fn create_series(
        ctx: Context<CreateSeries>,
        _series_id_hash: [u8; 32],
        terms_hash: [u8; 32],
        benefit_hash: [u8; 32],
        cap: u32,
        primary_price: u64,
        expiry: i64,
    ) -> Result<()> {
        require!(cap > 0 && primary_price > 0, EncoreError::InvalidAmount);
        let series = &mut ctx.accounts.series;
        series.artist = ctx.accounts.artist.key();
        series.track = ctx.accounts.track.key();
        series.terms_hash = terms_hash;
        series.benefit_hash = benefit_hash;
        series.mint = ctx.accounts.mint.key();
        series.cap = cap;
        series.issued = 0;
        series.primary_price = primary_price;
        series.expiry = expiry;
        series.primary_fee_bps = PRIMARY_PLATFORM_FEE_BPS as u16;
        series.resale_artist_bps = RESALE_ARTIST_FEE_BPS as u16;
        series.resale_fee_bps = RESALE_PLATFORM_FEE_BPS as u16;
        series.platform_wallet = ctx.accounts.platform_wallet.key();
        series.status = SeriesStatus::Active;
        series.bump = ctx.bumps.series;
        Ok(())
    }

    pub fn buy_primary(
        ctx: Context<BuyPrimary>,
        expected_version: u32,
        expected_manifest_hash: [u8; 32],
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let series = &mut ctx.accounts.series;
        require!(series.status == SeriesStatus::Active, EncoreError::TrackPaused);
        require!(series.issued < series.cap, EncoreError::SupplyCapReached);
        require!(now < series.expiry, EncoreError::TerminalPassState);

        assert_passport_eligible(
            &ctx.accounts.track,
            expected_version,
            expected_manifest_hash,
        )?;

        let platform_fee = compute_bps_fee(series.primary_price, series.primary_fee_bps as u64)?;
        let artist_payout = series
            .primary_price
            .checked_sub(platform_fee)
            .ok_or(EncoreError::MathOverflow)?;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer_ata.to_account_info(),
                    to: ctx.accounts.artist_ata.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            artist_payout,
        )?;
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer_ata.to_account_info(),
                    to: ctx.accounts.platform_ata.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            platform_fee,
        )?;

        series.issued = series.issued.checked_add(1).ok_or(EncoreError::MathOverflow)?;
        let pass = &mut ctx.accounts.pass;
        pass.series = series.key();
        pass.serial = series.issued;
        pass.owner = ctx.accounts.buyer.key();
        pass.status = PassStatus::Owned;
        pass.nonce = 0;
        pass.listing_price = 0;
        pass.listing_expiry = 0;
        Ok(())
    }

    pub fn redeem_pass(ctx: Context<RedeemPass>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let pass = &mut ctx.accounts.pass;
        require!(pass.owner == ctx.accounts.owner.key(), EncoreError::Unauthorized);
        assert_pass_non_terminal(pass.status)?;
        require!(now < ctx.accounts.series.expiry, EncoreError::TerminalPassState);

        pass.status = PassStatus::Redeemed;
        pass.nonce = pass.nonce.checked_add(1).ok_or(EncoreError::MathOverflow)?;
        pass.listing_price = 0;
        pass.listing_expiry = 0;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct RegisterArtist<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer = authority, space = 8 + Artist::INIT_SPACE, seeds = [b"artist", authority.key().as_ref()], bump)]
    pub artist: Account<'info, Artist>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(track_id_hash: [u8; 32])]
pub struct RegisterTrack<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [b"artist", authority.key().as_ref()], bump = artist.bump, constraint = artist.artist_authority == authority.key() @ EncoreError::Unauthorized)]
    pub artist: Account<'info, Artist>,
    #[account(init, payer = authority, space = 8 + Track::INIT_SPACE, seeds = [b"track", artist.key().as_ref(), &track_id_hash], bump)]
    pub track: Account<'info, Track>,
    #[account(init, payer = authority, space = 8 + PassportVersion::INIT_SPACE, seeds = [b"passport", track.key().as_ref(), &1u32.to_le_bytes()], bump)]
    pub passport_version: Account<'info, PassportVersion>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct DirectSupport<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub artist: Account<'info, Artist>,
    pub track: Account<'info, Track>,
    #[account(mut, constraint = payer_ata.owner == payer.key() @ EncoreError::Unauthorized)]
    pub payer_ata: Account<'info, TokenAccount>,
    #[account(mut, constraint = artist_ata.owner == artist.payout_wallet @ EncoreError::Unauthorized)]
    pub artist_ata: Account<'info, TokenAccount>,
    #[account(init, payer = payer, space = 8 + SupportReceipt::INIT_SPACE, seeds = [b"receipt", payer.key().as_ref(), &nonce.to_le_bytes()], bump)]
    pub support_receipt: Account<'info, SupportReceipt>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(series_id_hash: [u8; 32])]
pub struct CreateSeries<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(constraint = artist.artist_authority == authority.key() @ EncoreError::Unauthorized)]
    pub artist: Account<'info, Artist>,
    #[account(constraint = track.artist == artist.key() @ EncoreError::Unauthorized)]
    pub track: Account<'info, Track>,
    /// CHECK: SPL Mint validated by caller/client
    pub mint: UncheckedAccount<'info>,
    /// CHECK: Platform treasury wallet
    pub platform_wallet: UncheckedAccount<'info>,
    #[account(init, payer = authority, space = 8 + PassSeries::INIT_SPACE, seeds = [b"series", artist.key().as_ref(), &series_id_hash], bump)]
    pub series: Account<'info, PassSeries>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyPrimary<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    pub artist: Account<'info, Artist>,
    pub track: Account<'info, Track>,
    #[account(mut, constraint = series.track == track.key() @ EncoreError::Unauthorized)]
    pub series: Account<'info, PassSeries>,
    #[account(init, payer = buyer, space = 8 + SupporterPass::INIT_SPACE, seeds = [b"pass", series.key().as_ref(), &(series.issued + 1).to_le_bytes()], bump)]
    pub pass: Account<'info, SupporterPass>,
    #[account(mut, constraint = buyer_ata.owner == buyer.key() && buyer_ata.mint == series.mint @ EncoreError::Unauthorized)]
    pub buyer_ata: Account<'info, TokenAccount>,
    #[account(mut, constraint = artist_ata.owner == artist.payout_wallet && artist_ata.mint == series.mint @ EncoreError::Unauthorized)]
    pub artist_ata: Account<'info, TokenAccount>,
    #[account(mut, constraint = platform_ata.owner == series.platform_wallet && platform_ata.mint == series.mint @ EncoreError::Unauthorized)]
    pub platform_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RedeemPass<'info> {
    pub owner: Signer<'info>,
    pub series: Account<'info, PassSeries>,
    #[account(mut, constraint = pass.series == series.key() @ EncoreError::Unauthorized)]
    pub pass: Account<'info, SupporterPass>,
}
