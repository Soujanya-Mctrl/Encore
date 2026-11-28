#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use constants::{PRIMARY_PLATFORM_FEE_BPS, RESALE_ARTIST_FEE_BPS, RESALE_PLATFORM_FEE_BPS};
use errors::EncoreError;
use events::*;
use utils::fee_math::compute_bps_fee;
use utils::merkle::{distribution_leaf, verify_merkle_proof};
use validation::{assert_pass_non_terminal, assert_passport_eligible};

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;
pub mod utils;
pub mod validation;

use state::*;

declare_id!("5y78zJvy7hnz2XpBRFLeqVh4Urt4ZEFPsDJHCqotLUu8");

#[program]
pub mod encore {
    use super::*;

    pub fn register_artist(ctx: Context<RegisterArtist>, profile_hash: [u8; 32]) -> Result<()> {
        let a = &mut ctx.accounts.artist;
        a.authority = ctx.accounts.authority.key();
        a.profile_hash = profile_hash;
        a.bump = ctx.bumps.artist;
        Ok(())
    }

    pub fn register_track(
        ctx: Context<RegisterTrack>,
        track_id_hash: [u8; 32],
        manifest_hash: [u8; 32],
    ) -> Result<()> {
        require!(manifest_hash != [0; 32], EncoreError::StalePassportVersion);
        let t = &mut ctx.accounts.track;
        t.artist = ctx.accounts.artist.key();
        t.track_id_hash = track_id_hash;
        t.current_version = 1;
        t.current_hash = manifest_hash;
        t.paused = false;
        t.bump = ctx.bumps.track;
        let p = &mut ctx.accounts.passport;
        p.track = t.key();
        p.version = 1;
        p.previous_hash = [0; 32];
        p.manifest_hash = manifest_hash;
        p.recorded_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn append_version(
        ctx: Context<AppendVersion>,
        version: u32,
        previous_hash: [u8; 32],
        manifest_hash: [u8; 32],
    ) -> Result<()> {
        let t = &mut ctx.accounts.track;
        require!(!t.paused, EncoreError::TrackPaused);
        require!(
            t.current_version.checked_add(1) == Some(version)
                && t.current_hash == previous_hash
                && manifest_hash != [0; 32],
            EncoreError::StalePassportVersion
        );
        let p = &mut ctx.accounts.passport;
        p.track = t.key();
        p.version = version;
        p.previous_hash = previous_hash;
        p.manifest_hash = manifest_hash;
        p.recorded_at = Clock::get()?.unix_timestamp;
        t.current_version = version;
        t.current_hash = manifest_hash;
        Ok(())
    }

    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        ctx.accounts.track.paused = paused;
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
        receipt.recipient = ctx.accounts.artist.authority;
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
        let now = Clock::get()?.unix_timestamp;
        require!(!ctx.accounts.track.paused, EncoreError::TrackPaused);
        require!(cap > 0 && primary_price > 0, EncoreError::InvalidAmount);
        require!(expiry > now, EncoreError::TerminalPassState);
        require!(
            ctx.accounts.platform_wallet.key() != Pubkey::default(),
            EncoreError::Unauthorized
        );

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

        emit!(SeriesCreatedEvent {
            series: series.key(),
            artist: series.artist,
            track: series.track,
            mint: series.mint,
            cap,
            primary_price,
            expiry,
        });
        Ok(())
    }

    pub fn buy_primary(
        ctx: Context<BuyPrimary>,
        expected_version: u32,
        expected_manifest_hash: [u8; 32],
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let series = &mut ctx.accounts.series;
        require!(
            series.status == SeriesStatus::Active,
            EncoreError::TrackPaused
        );
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
        if platform_fee > 0 {
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
        }

        series.issued = series
            .issued
            .checked_add(1)
            .ok_or(EncoreError::MathOverflow)?;
        let pass = &mut ctx.accounts.pass;
        pass.series = series.key();
        pass.serial = series.issued;
        pass.owner = ctx.accounts.buyer.key();
        pass.status = PassStatus::Owned;
        pass.nonce = 0;
        pass.listing_price = 0;
        pass.listing_expiry = 0;

        emit!(PassPurchasedEvent {
            series: series.key(),
            pass: pass.key(),
            serial: pass.serial,
            buyer: pass.owner,
            artist_payout,
            platform_fee,
            version: expected_version,
            manifest_hash: expected_manifest_hash,
        });
        Ok(())
    }

    pub fn list_pass(
        ctx: Context<ListPass>,
        listing_price: u64,
        listing_expiry: i64,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(!ctx.accounts.track.paused, EncoreError::TrackPaused);
        require!(
            ctx.accounts.series.status == SeriesStatus::Active,
            EncoreError::TrackPaused
        );
        let pass = &mut ctx.accounts.pass;
        require!(
            pass.owner == ctx.accounts.owner.key(),
            EncoreError::Unauthorized
        );
        require!(pass.status == PassStatus::Owned, EncoreError::TerminalPassState);
        require!(listing_price > 0, EncoreError::InvalidAmount);
        require!(
            listing_expiry > now && listing_expiry <= ctx.accounts.series.expiry,
            EncoreError::TerminalPassState
        );
        pass.status = PassStatus::Listed;
        pass.nonce = pass.nonce.checked_add(1).ok_or(EncoreError::MathOverflow)?;
        pass.listing_price = listing_price;
        pass.listing_expiry = listing_expiry;

        emit!(PassListedEvent {
            series: ctx.accounts.series.key(),
            pass: pass.key(),
            owner: pass.owner,
            listing_price,
            listing_expiry,
            nonce: pass.nonce,
        });
        Ok(())
    }

    pub fn cancel_pass_listing(ctx: Context<CancelPassListing>) -> Result<()> {
        let pass = &mut ctx.accounts.pass;
        require!(
            pass.owner == ctx.accounts.owner.key(),
            EncoreError::Unauthorized
        );
        require!(pass.status == PassStatus::Listed, EncoreError::TerminalPassState);
        pass.status = PassStatus::Owned;
        pass.nonce = pass.nonce.checked_add(1).ok_or(EncoreError::MathOverflow)?;
        pass.listing_price = 0;
        pass.listing_expiry = 0;

        emit!(PassListingCancelledEvent {
            series: ctx.accounts.series.key(),
            pass: pass.key(),
            owner: pass.owner,
            nonce: pass.nonce,
        });
        Ok(())
    }

    pub fn buy_listing(
        ctx: Context<BuyListing>,
        expected_nonce: u64,
        expected_version: u32,
        expected_manifest_hash: [u8; 32],
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let series = &ctx.accounts.series;
        let pass = &mut ctx.accounts.pass;
        require!(
            series.status == SeriesStatus::Active,
            EncoreError::TrackPaused
        );
        assert_passport_eligible(
            &ctx.accounts.track,
            expected_version,
            expected_manifest_hash,
        )?;
        require!(pass.status == PassStatus::Listed, EncoreError::TerminalPassState);
        require!(pass.nonce == expected_nonce, EncoreError::Unauthorized);
        require!(
            now < pass.listing_expiry && now < series.expiry,
            EncoreError::TerminalPassState
        );
        require!(
            ctx.accounts.buyer.key() != pass.owner,
            EncoreError::Unauthorized
        );

        let seller = pass.owner;
        let price = pass.listing_price;
        let artist_fee = compute_bps_fee(price, series.resale_artist_bps as u64)?;
        let platform_fee = compute_bps_fee(price, series.resale_fee_bps as u64)?;
        let seller_payout = price
            .checked_sub(artist_fee)
            .and_then(|v| v.checked_sub(platform_fee))
            .ok_or(EncoreError::MathOverflow)?;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer_ata.to_account_info(),
                    to: ctx.accounts.seller_ata.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            seller_payout,
        )?;
        if artist_fee > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.buyer_ata.to_account_info(),
                        to: ctx.accounts.artist_ata.to_account_info(),
                        authority: ctx.accounts.buyer.to_account_info(),
                    },
                ),
                artist_fee,
            )?;
        }
        if platform_fee > 0 {
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
        }

        pass.owner = ctx.accounts.buyer.key();
        pass.status = PassStatus::Owned;
        pass.nonce = pass.nonce.checked_add(1).ok_or(EncoreError::MathOverflow)?;
        pass.listing_price = 0;
        pass.listing_expiry = 0;

        emit!(PassResoldEvent {
            series: series.key(),
            pass: pass.key(),
            seller,
            buyer: pass.owner,
            price,
            seller_payout,
            artist_fee,
            platform_fee,
            nonce: pass.nonce,
            version: expected_version,
            manifest_hash: expected_manifest_hash,
        });
        Ok(())
    }

    pub fn redeem_pass(ctx: Context<RedeemPass>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let pass = &mut ctx.accounts.pass;
        require!(
            pass.owner == ctx.accounts.owner.key(),
            EncoreError::Unauthorized
        );
        assert_pass_non_terminal(pass.status)?;
        require!(
            now < ctx.accounts.series.expiry,
            EncoreError::TerminalPassState
        );

        pass.status = PassStatus::Redeemed;
        pass.nonce = pass.nonce.checked_add(1).ok_or(EncoreError::MathOverflow)?;
        pass.listing_price = 0;
        pass.listing_expiry = 0;

        emit!(PassRedeemedEvent {
            series: ctx.accounts.series.key(),
            pass: pass.key(),
            owner: pass.owner,
            nonce: pass.nonce,
        });
        Ok(())
    }

    pub fn expire_pass(ctx: Context<ExpirePass>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let pass = &mut ctx.accounts.pass;
        assert_pass_non_terminal(pass.status)?;
        require!(
            now >= ctx.accounts.series.expiry,
            EncoreError::CampaignStillActive
        );

        pass.status = PassStatus::Expired;
        pass.nonce = pass.nonce.checked_add(1).ok_or(EncoreError::MathOverflow)?;
        pass.listing_price = 0;
        pass.listing_expiry = 0;

        emit!(PassExpiredEvent {
            series: ctx.accounts.series.key(),
            pass: pass.key(),
            nonce: pass.nonce,
        });
        Ok(())
    }

    pub fn create_campaign(
        ctx: Context<CreateCampaign>,
        campaign_id_hash: [u8; 32],
        terms_hash: [u8; 32],
        goal: u64,
        share_supply: u64,
        deadline: i64,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(!ctx.accounts.track.paused, EncoreError::TrackPaused);
        require!(goal > 0 && share_supply > 0, EncoreError::InvalidAmount);
        require!(deadline > now, EncoreError::TerminalPassState);

        let campaign = &mut ctx.accounts.campaign;
        campaign.artist = ctx.accounts.artist.key();
        campaign.track = ctx.accounts.track.key();
        campaign.campaign_id_hash = campaign_id_hash;
        campaign.terms_hash = terms_hash;
        campaign.mint = ctx.accounts.mint.key();
        campaign.vault = ctx.accounts.campaign_vault.key();
        campaign.goal = goal;
        campaign.raised = 0;
        campaign.released_amount = 0;
        campaign.share_supply = share_supply;
        campaign.deadline = deadline;
        campaign.status = CampaignStatus::Funding;
        campaign.bump = ctx.bumps.campaign;

        emit!(CampaignCreatedEvent {
            campaign: campaign.key(),
            artist: campaign.artist,
            track: campaign.track,
            mint: campaign.mint,
            vault: campaign.vault,
            goal,
            share_supply,
            deadline,
        });
        Ok(())
    }

    pub fn pledge_campaign(
        ctx: Context<PledgeCampaign>,
        nonce: u64,
        amount: u64,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let campaign = &mut ctx.accounts.campaign;
        require!(
            campaign.status == CampaignStatus::Funding,
            EncoreError::TrackPaused
        );
        require!(now < campaign.deadline, EncoreError::TerminalPassState);
        require!(amount > 0, EncoreError::InvalidAmount);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.payer_ata.to_account_info(),
                    to: ctx.accounts.vault_ata.to_account_info(),
                    authority: ctx.accounts.payer.to_account_info(),
                },
            ),
            amount,
        )?;

        campaign.raised = campaign
            .raised
            .checked_add(amount)
            .ok_or(EncoreError::MathOverflow)?;
        if campaign.raised >= campaign.goal {
            campaign.status = CampaignStatus::Funded;
        }

        let pledge = &mut ctx.accounts.pledge;
        pledge.campaign = campaign.key();
        pledge.payer = ctx.accounts.payer.key();
        pledge.nonce = nonce;
        pledge.amount = amount;
        pledge.refunded = false;
        pledge.bump = ctx.bumps.pledge;

        emit!(CampaignPledgedEvent {
            campaign: campaign.key(),
            pledge: pledge.key(),
            payer: pledge.payer,
            amount,
            total_raised: campaign.raised,
            status: campaign.status,
        });
        Ok(())
    }

    pub fn release_milestone(
        ctx: Context<ReleaseMilestone>,
        milestone_index: u32,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, EncoreError::InvalidAmount);
        let campaign_key = ctx.accounts.campaign.key();
        let artist_key = ctx.accounts.campaign.artist;
        let campaign_id_hash = ctx.accounts.campaign.campaign_id_hash;
        let bump = ctx.accounts.campaign.bump;

        let campaign = &mut ctx.accounts.campaign;
        require!(
            campaign.status == CampaignStatus::Funded,
            EncoreError::CampaignNotFunded
        );
        let next_released = campaign
            .released_amount
            .checked_add(amount)
            .ok_or(EncoreError::MathOverflow)?;
        require!(next_released <= campaign.raised, EncoreError::InvalidAmount);

        let signer_seeds: &[&[&[u8]]] = &[&[
            b"campaign",
            artist_key.as_ref(),
            campaign_id_hash.as_ref(),
            &[bump],
        ]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_ata.to_account_info(),
                    to: ctx.accounts.artist_ata.to_account_info(),
                    authority: ctx.accounts.campaign.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        ctx.accounts.campaign.released_amount = next_released;
        emit!(CampaignMilestoneReleasedEvent {
            campaign: campaign_key,
            milestone_index,
            amount,
            recipient: ctx.accounts.artist.authority,
            total_released: next_released,
        });
        Ok(())
    }

    pub fn refund_campaign(ctx: Context<RefundCampaign>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let campaign_key = ctx.accounts.campaign.key();
        let artist_key = ctx.accounts.campaign.artist;
        let campaign_id_hash = ctx.accounts.campaign.campaign_id_hash;
        let bump = ctx.accounts.campaign.bump;

        let campaign = &mut ctx.accounts.campaign;
        let past_deadline_unfunded =
            campaign.status == CampaignStatus::Funding
                && now >= campaign.deadline
                && campaign.raised < campaign.goal;
        if past_deadline_unfunded {
            campaign.status = CampaignStatus::Failed;
        }
        require!(
            campaign.status == CampaignStatus::Failed,
            EncoreError::CampaignStillActive
        );

        let pledge = &mut ctx.accounts.pledge;
        require!(!pledge.refunded, EncoreError::RefundAlreadyClaimed);
        require!(pledge.amount > 0, EncoreError::InvalidAmount);

        let refund_amount = pledge.amount;
        pledge.refunded = true;

        let signer_seeds: &[&[&[u8]]] = &[&[
            b"campaign",
            artist_key.as_ref(),
            campaign_id_hash.as_ref(),
            &[bump],
        ]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_ata.to_account_info(),
                    to: ctx.accounts.claimer_ata.to_account_info(),
                    authority: ctx.accounts.campaign.to_account_info(),
                },
                signer_seeds,
            ),
            refund_amount,
        )?;

        emit!(CampaignRefundedEvent {
            campaign: campaign_key,
            pledge: pledge.key(),
            claimer: ctx.accounts.claimer.key(),
            amount: refund_amount,
        });
        Ok(())
    }

    pub fn create_spot_listing(
        ctx: Context<CreateSpotListing>,
        listing_id_hash: [u8; 32],
        units: u32,
        unit_price: u64,
    ) -> Result<()> {
        require!(
            ctx.accounts.campaign.status == CampaignStatus::Funded,
            EncoreError::CampaignNotFunded
        );
        require!(units > 0 && unit_price > 0, EncoreError::InvalidAmount);

        let listing = &mut ctx.accounts.spot_listing;
        listing.campaign = ctx.accounts.campaign.key();
        listing.seller = ctx.accounts.seller.key();
        listing.listing_id_hash = listing_id_hash;
        listing.mint = ctx.accounts.campaign.mint;
        listing.total_units = units;
        listing.remaining_units = units;
        listing.unit_price = unit_price;
        listing.nonce = 0;
        listing.active = true;
        listing.bump = ctx.bumps.spot_listing;

        emit!(SpotListingCreatedEvent {
            listing: listing.key(),
            campaign: listing.campaign,
            seller: listing.seller,
            units,
            unit_price,
        });
        Ok(())
    }

    pub fn cancel_spot_listing(ctx: Context<CancelSpotListing>) -> Result<()> {
        let listing = &mut ctx.accounts.spot_listing;
        require!(listing.active, EncoreError::SpotListingInactive);
        listing.active = false;
        listing.remaining_units = 0;
        listing.nonce = listing.nonce.checked_add(1).ok_or(EncoreError::MathOverflow)?;

        emit!(SpotListingCancelledEvent {
            listing: listing.key(),
            campaign: listing.campaign,
            seller: listing.seller,
            nonce: listing.nonce,
        });
        Ok(())
    }

    pub fn buy_spot(
        ctx: Context<BuySpot>,
        units: u32,
        expected_nonce: u64,
    ) -> Result<()> {
        let listing = &mut ctx.accounts.spot_listing;
        require!(listing.active, EncoreError::SpotListingInactive);
        require!(listing.nonce == expected_nonce, EncoreError::Unauthorized);
        require!(
            units > 0 && units <= listing.remaining_units,
            EncoreError::SpotListingInactive
        );
        require!(
            ctx.accounts.buyer.key() != listing.seller,
            EncoreError::Unauthorized
        );

        let total_amount = (units as u64)
            .checked_mul(listing.unit_price)
            .ok_or(EncoreError::MathOverflow)?;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer_ata.to_account_info(),
                    to: ctx.accounts.seller_ata.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            total_amount,
        )?;

        listing.remaining_units = listing
            .remaining_units
            .checked_sub(units)
            .ok_or(EncoreError::MathOverflow)?;
        if listing.remaining_units == 0 {
            listing.active = false;
        }
        listing.nonce = listing.nonce.checked_add(1).ok_or(EncoreError::MathOverflow)?;

        emit!(SpotFilledEvent {
            listing: listing.key(),
            campaign: listing.campaign,
            seller: listing.seller,
            buyer: ctx.accounts.buyer.key(),
            units,
            unit_price: listing.unit_price,
            total_amount,
            remaining_units: listing.remaining_units,
            nonce: listing.nonce,
        });
        Ok(())
    }

    pub fn open_distribution_cycle(
        ctx: Context<OpenDistributionCycle>,
        cycle_id_hash: [u8; 32],
        evidence_hash: [u8; 32],
        merkle_root: [u8; 32],
        verified_revenue: u64,
        total_supply_snapshot: u64,
    ) -> Result<()> {
        require!(
            ctx.accounts.campaign.status == CampaignStatus::Funded,
            EncoreError::CampaignNotFunded
        );
        require!(
            verified_revenue > 0 && total_supply_snapshot > 0,
            EncoreError::InvalidAmount
        );
        require!(merkle_root != [0; 32], EncoreError::InvalidMerkleProof);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.funder_ata.to_account_info(),
                    to: ctx.accounts.distribution_vault.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            verified_revenue,
        )?;

        let cycle = &mut ctx.accounts.cycle;
        cycle.campaign = ctx.accounts.campaign.key();
        cycle.authority = ctx.accounts.authority.key();
        cycle.cycle_id_hash = cycle_id_hash;
        cycle.mint = ctx.accounts.mint.key();
        cycle.vault = ctx.accounts.distribution_vault.key();
        cycle.evidence_hash = evidence_hash;
        cycle.merkle_root = merkle_root;
        cycle.verified_revenue = verified_revenue;
        cycle.claimed_amount = 0;
        cycle.total_supply_snapshot = total_supply_snapshot;
        cycle.open = true;
        cycle.bump = ctx.bumps.cycle;

        emit!(DistributionCycleOpenedEvent {
            cycle: cycle.key(),
            campaign: cycle.campaign,
            vault: cycle.vault,
            verified_revenue,
            merkle_root,
            total_supply_snapshot,
        });
        Ok(())
    }

    pub fn claim_distribution(
        ctx: Context<ClaimDistribution>,
        amount: u64,
        proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        let cycle_key = ctx.accounts.cycle.key();
        let campaign_key = ctx.accounts.cycle.campaign;
        let cycle_id_hash = ctx.accounts.cycle.cycle_id_hash;
        let bump = ctx.accounts.cycle.bump;

        let cycle = &mut ctx.accounts.cycle;
        require!(cycle.open, EncoreError::DistributionClosed);
        require!(amount > 0, EncoreError::InvalidAmount);
        let next_claimed = cycle
            .claimed_amount
            .checked_add(amount)
            .ok_or(EncoreError::MathOverflow)?;
        require!(
            next_claimed <= cycle.verified_revenue,
            EncoreError::DistributionClosed
        );

        let leaf = distribution_leaf(&ctx.accounts.claimer.key(), amount);
        require!(
            verify_merkle_proof(&proof, cycle.merkle_root, leaf),
            EncoreError::InvalidMerkleProof
        );

        let signer_seeds: &[&[&[u8]]] = &[&[
            b"distribution_cycle",
            campaign_key.as_ref(),
            cycle_id_hash.as_ref(),
            &[bump],
        ]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.distribution_vault.to_account_info(),
                    to: ctx.accounts.claimer_ata.to_account_info(),
                    authority: ctx.accounts.cycle.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        ctx.accounts.cycle.claimed_amount = next_claimed;
        let claim = &mut ctx.accounts.claim;
        claim.cycle = cycle_key;
        claim.claimer = ctx.accounts.claimer.key();
        claim.amount = amount;
        claim.claimed_at = Clock::get()?.unix_timestamp;
        claim.bump = ctx.bumps.claim;

        emit!(DistributionClaimedEvent {
            cycle: cycle_key,
            claimer: claim.claimer,
            amount,
            total_claimed: next_claimed,
        });
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
    #[account(seeds = [b"artist", authority.key().as_ref()], bump = artist.bump, has_one = authority)]
    pub artist: Account<'info, Artist>,
    #[account(init, payer = authority, space = 8 + Track::INIT_SPACE, seeds = [b"track", artist.key().as_ref(), track_id_hash.as_ref()], bump)]
    pub track: Account<'info, Track>,
    #[account(init, payer = authority, space = 8 + PassportVersion::INIT_SPACE, seeds = [b"passport", track.key().as_ref(), 1u32.to_le_bytes().as_ref()], bump)]
    pub passport: Account<'info, PassportVersion>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(version: u32)]
pub struct AppendVersion<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [b"artist", authority.key().as_ref()], bump = artist.bump, has_one = authority)]
    pub artist: Account<'info, Artist>,
    #[account(mut, has_one = artist, seeds = [b"track", artist.key().as_ref(), track.track_id_hash.as_ref()], bump = track.bump)]
    pub track: Account<'info, Track>,
    #[account(init, payer = authority, space = 8 + PassportVersion::INIT_SPACE, seeds = [b"passport", track.key().as_ref(), version.to_le_bytes().as_ref()], bump)]
    pub passport: Account<'info, PassportVersion>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPaused<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [b"artist", authority.key().as_ref()], bump = artist.bump, has_one = authority)]
    pub artist: Account<'info, Artist>,
    #[account(mut, has_one = artist, seeds = [b"track", artist.key().as_ref(), track.track_id_hash.as_ref()], bump = track.bump)]
    pub track: Account<'info, Track>,
}

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct DirectSupport<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub artist: Account<'info, Artist>,
    #[account(has_one = artist)]
    pub track: Account<'info, Track>,
    pub mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = payer_ata.owner == payer.key() && payer_ata.mint == mint.key() @ EncoreError::Unauthorized)]
    pub payer_ata: Box<Account<'info, TokenAccount>>,
    #[account(mut, constraint = artist_ata.owner == artist.authority && artist_ata.mint == mint.key() @ EncoreError::Unauthorized)]
    pub artist_ata: Box<Account<'info, TokenAccount>>,
    #[account(init, payer = payer, space = 8 + SupportReceipt::INIT_SPACE, seeds = [b"receipt", payer.key().as_ref(), &nonce.to_le_bytes()], bump)]
    pub support_receipt: Box<Account<'info, SupportReceipt>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(series_id_hash: [u8; 32])]
pub struct CreateSeries<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(constraint = artist.authority == authority.key() @ EncoreError::Unauthorized)]
    pub artist: Account<'info, Artist>,
    #[account(constraint = track.artist == artist.key() @ EncoreError::Unauthorized)]
    pub track: Account<'info, Track>,
    pub mint: Box<Account<'info, Mint>>,
    /// CHECK: Platform treasury wallet validated non-default in instruction
    pub platform_wallet: UncheckedAccount<'info>,
    #[account(init, payer = authority, space = 8 + PassSeries::INIT_SPACE, seeds = [b"series", artist.key().as_ref(), &series_id_hash], bump)]
    pub series: Box<Account<'info, PassSeries>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyPrimary<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    pub artist: Account<'info, Artist>,
    pub track: Account<'info, Track>,
    #[account(mut, constraint = series.track == track.key() && series.artist == artist.key() @ EncoreError::Unauthorized)]
    pub series: Box<Account<'info, PassSeries>>,
    #[account(init, payer = buyer, space = 8 + SupporterPass::INIT_SPACE, seeds = [b"pass", series.key().as_ref(), &(series.issued + 1).to_le_bytes()], bump)]
    pub pass: Box<Account<'info, SupporterPass>>,
    #[account(mut, constraint = buyer_ata.owner == buyer.key() && buyer_ata.mint == series.mint @ EncoreError::Unauthorized)]
    pub buyer_ata: Box<Account<'info, TokenAccount>>,
    #[account(mut, constraint = artist_ata.owner == artist.authority && artist_ata.mint == series.mint @ EncoreError::Unauthorized)]
    pub artist_ata: Box<Account<'info, TokenAccount>>,
    #[account(mut, constraint = platform_ata.owner == series.platform_wallet && platform_ata.mint == series.mint @ EncoreError::Unauthorized)]
    pub platform_ata: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ListPass<'info> {
    pub owner: Signer<'info>,
    pub track: Account<'info, Track>,
    #[account(constraint = series.track == track.key() @ EncoreError::Unauthorized)]
    pub series: Account<'info, PassSeries>,
    #[account(mut, constraint = pass.series == series.key() @ EncoreError::Unauthorized)]
    pub pass: Account<'info, SupporterPass>,
}

#[derive(Accounts)]
pub struct CancelPassListing<'info> {
    pub owner: Signer<'info>,
    pub series: Account<'info, PassSeries>,
    #[account(mut, constraint = pass.series == series.key() @ EncoreError::Unauthorized)]
    pub pass: Account<'info, SupporterPass>,
}

#[derive(Accounts)]
pub struct BuyListing<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    pub artist: Account<'info, Artist>,
    pub track: Account<'info, Track>,
    #[account(constraint = series.track == track.key() && series.artist == artist.key() @ EncoreError::Unauthorized)]
    pub series: Box<Account<'info, PassSeries>>,
    #[account(mut, constraint = pass.series == series.key() @ EncoreError::Unauthorized)]
    pub pass: Box<Account<'info, SupporterPass>>,
    #[account(mut, constraint = buyer_ata.owner == buyer.key() && buyer_ata.mint == series.mint @ EncoreError::Unauthorized)]
    pub buyer_ata: Box<Account<'info, TokenAccount>>,
    #[account(mut, constraint = seller_ata.owner == pass.owner && seller_ata.mint == series.mint @ EncoreError::Unauthorized)]
    pub seller_ata: Box<Account<'info, TokenAccount>>,
    #[account(mut, constraint = artist_ata.owner == artist.authority && artist_ata.mint == series.mint @ EncoreError::Unauthorized)]
    pub artist_ata: Box<Account<'info, TokenAccount>>,
    #[account(mut, constraint = platform_ata.owner == series.platform_wallet && platform_ata.mint == series.mint @ EncoreError::Unauthorized)]
    pub platform_ata: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RedeemPass<'info> {
    pub owner: Signer<'info>,
    pub series: Account<'info, PassSeries>,
    #[account(mut, constraint = pass.series == series.key() @ EncoreError::Unauthorized)]
    pub pass: Account<'info, SupporterPass>,
}

#[derive(Accounts)]
pub struct ExpirePass<'info> {
    pub series: Account<'info, PassSeries>,
    #[account(mut, constraint = pass.series == series.key() @ EncoreError::Unauthorized)]
    pub pass: Account<'info, SupporterPass>,
}

#[derive(Accounts)]
#[instruction(campaign_id_hash: [u8; 32])]
pub struct CreateCampaign<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(constraint = artist.authority == authority.key() @ EncoreError::Unauthorized)]
    pub artist: Account<'info, Artist>,
    #[account(constraint = track.artist == artist.key() @ EncoreError::Unauthorized)]
    pub track: Account<'info, Track>,
    pub mint: Box<Account<'info, Mint>>,
    #[account(init, payer = authority, space = 8 + Campaign::INIT_SPACE, seeds = [b"campaign", artist.key().as_ref(), &campaign_id_hash], bump)]
    pub campaign: Box<Account<'info, Campaign>>,
    #[account(init, payer = authority, token::mint = mint, token::authority = campaign, seeds = [b"campaign_vault", campaign.key().as_ref()], bump)]
    pub campaign_vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct PledgeCampaign<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub campaign: Box<Account<'info, Campaign>>,
    #[account(init, payer = payer, space = 8 + CampaignPledge::INIT_SPACE, seeds = [b"pledge", campaign.key().as_ref(), payer.key().as_ref(), &nonce.to_le_bytes()], bump)]
    pub pledge: Box<Account<'info, CampaignPledge>>,
    #[account(mut, constraint = payer_ata.owner == payer.key() && payer_ata.mint == campaign.mint @ EncoreError::Unauthorized)]
    pub payer_ata: Box<Account<'info, TokenAccount>>,
    #[account(mut, constraint = vault_ata.key() == campaign.vault && vault_ata.mint == campaign.mint @ EncoreError::Unauthorized)]
    pub vault_ata: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReleaseMilestone<'info> {
    pub authority: Signer<'info>,
    #[account(constraint = artist.authority == authority.key() @ EncoreError::Unauthorized)]
    pub artist: Account<'info, Artist>,
    #[account(mut, has_one = artist)]
    pub campaign: Box<Account<'info, Campaign>>,
    #[account(mut, constraint = vault_ata.key() == campaign.vault && vault_ata.mint == campaign.mint @ EncoreError::Unauthorized)]
    pub vault_ata: Box<Account<'info, TokenAccount>>,
    #[account(mut, constraint = artist_ata.owner == artist.authority && artist_ata.mint == campaign.mint @ EncoreError::Unauthorized)]
    pub artist_ata: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RefundCampaign<'info> {
    pub claimer: Signer<'info>,
    #[account(mut)]
    pub campaign: Box<Account<'info, Campaign>>,
    #[account(mut, constraint = pledge.campaign == campaign.key() && pledge.payer == claimer.key() @ EncoreError::Unauthorized)]
    pub pledge: Box<Account<'info, CampaignPledge>>,
    #[account(mut, constraint = vault_ata.key() == campaign.vault && vault_ata.mint == campaign.mint @ EncoreError::Unauthorized)]
    pub vault_ata: Box<Account<'info, TokenAccount>>,
    #[account(mut, constraint = claimer_ata.owner == claimer.key() && claimer_ata.mint == campaign.mint @ EncoreError::Unauthorized)]
    pub claimer_ata: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(listing_id_hash: [u8; 32])]
pub struct CreateSpotListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    pub campaign: Account<'info, Campaign>,
    #[account(init, payer = seller, space = 8 + SpotListing::INIT_SPACE, seeds = [b"spot_listing", campaign.key().as_ref(), seller.key().as_ref(), &listing_id_hash], bump)]
    pub spot_listing: Account<'info, SpotListing>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelSpotListing<'info> {
    pub seller: Signer<'info>,
    #[account(mut, constraint = spot_listing.seller == seller.key() @ EncoreError::Unauthorized)]
    pub spot_listing: Account<'info, SpotListing>,
}

#[derive(Accounts)]
pub struct BuySpot<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut)]
    pub spot_listing: Box<Account<'info, SpotListing>>,
    #[account(mut, constraint = buyer_ata.owner == buyer.key() && buyer_ata.mint == spot_listing.mint @ EncoreError::Unauthorized)]
    pub buyer_ata: Box<Account<'info, TokenAccount>>,
    #[account(mut, constraint = seller_ata.owner == spot_listing.seller && seller_ata.mint == spot_listing.mint @ EncoreError::Unauthorized)]
    pub seller_ata: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(cycle_id_hash: [u8; 32])]
pub struct OpenDistributionCycle<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    pub campaign: Box<Account<'info, Campaign>>,
    pub mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = funder_ata.owner == authority.key() && funder_ata.mint == mint.key() @ EncoreError::Unauthorized)]
    pub funder_ata: Box<Account<'info, TokenAccount>>,
    #[account(init, payer = authority, space = 8 + DistributionCycle::INIT_SPACE, seeds = [b"distribution_cycle", campaign.key().as_ref(), &cycle_id_hash], bump)]
    pub cycle: Box<Account<'info, DistributionCycle>>,
    #[account(init, payer = authority, token::mint = mint, token::authority = cycle, seeds = [b"distribution_vault", cycle.key().as_ref()], bump)]
    pub distribution_vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimDistribution<'info> {
    #[account(mut)]
    pub claimer: Signer<'info>,
    #[account(mut)]
    pub cycle: Box<Account<'info, DistributionCycle>>,
    #[account(mut, constraint = distribution_vault.key() == cycle.vault && distribution_vault.mint == cycle.mint @ EncoreError::Unauthorized)]
    pub distribution_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, constraint = claimer_ata.owner == claimer.key() && claimer_ata.mint == cycle.mint @ EncoreError::Unauthorized)]
    pub claimer_ata: Box<Account<'info, TokenAccount>>,
    #[account(init, payer = claimer, space = 8 + DistributionClaim::INIT_SPACE, seeds = [b"dist_claim", cycle.key().as_ref(), claimer.key().as_ref()], bump)]
    pub claim: Box<Account<'info, DistributionClaim>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
