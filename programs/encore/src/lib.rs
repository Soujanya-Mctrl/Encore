#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;
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
        require!(
            manifest_hash != [0; 32],
            errors::EncoreError::StalePassportVersion
        );
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
        require!(!t.paused, errors::EncoreError::TrackPaused);
        require!(
            t.current_version.checked_add(1) == Some(version)
                && t.current_hash == previous_hash
                && manifest_hash != [0; 32],
            errors::EncoreError::StalePassportVersion
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
}
#[derive(Accounts)]
pub struct RegisterArtist<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init,payer=authority,space=8+Artist::INIT_SPACE,seeds=[b"artist",authority.key().as_ref()],bump)]
    pub artist: Account<'info, Artist>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
#[instruction(track_id_hash:[u8;32])]
pub struct RegisterTrack<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds=[b"artist",authority.key().as_ref()],bump=artist.bump,has_one=authority)]
    pub artist: Account<'info, Artist>,
    #[account(init,payer=authority,space=8+Track::INIT_SPACE,seeds=[b"track",artist.key().as_ref(),track_id_hash.as_ref()],bump)]
    pub track: Account<'info, Track>,
    #[account(init,payer=authority,space=8+PassportVersion::INIT_SPACE,seeds=[b"passport",track.key().as_ref(),1u32.to_le_bytes().as_ref()],bump)]
    pub passport: Account<'info, PassportVersion>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
#[instruction(version:u32)]
pub struct AppendVersion<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds=[b"artist",authority.key().as_ref()],bump=artist.bump,has_one=authority)]
    pub artist: Account<'info, Artist>,
    #[account(mut,has_one=artist,seeds=[b"track",artist.key().as_ref(),track.track_id_hash.as_ref()],bump=track.bump)]
    pub track: Account<'info, Track>,
    #[account(init,payer=authority,space=8+PassportVersion::INIT_SPACE,seeds=[b"passport",track.key().as_ref(),version.to_le_bytes().as_ref()],bump)]
    pub passport: Account<'info, PassportVersion>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct SetPaused<'info> {
    pub authority: Signer<'info>,
    #[account(seeds=[b"artist",authority.key().as_ref()],bump=artist.bump,has_one=authority)]
    pub artist: Account<'info, Artist>,
    #[account(mut,has_one=artist,seeds=[b"track",artist.key().as_ref(),track.track_id_hash.as_ref()],bump=track.bump)]
    pub track: Account<'info, Track>,
}
