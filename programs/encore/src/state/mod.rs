use anchor_lang::prelude::*;
#[account]
#[derive(InitSpace)]
pub struct Artist {
    pub authority: Pubkey,
    pub profile_hash: [u8; 32],
    pub bump: u8,
}
#[account]
#[derive(InitSpace)]
pub struct Track {
    pub artist: Pubkey,
    pub track_id_hash: [u8; 32],
    pub current_version: u32,
    pub current_hash: [u8; 32],
    pub paused: bool,
    pub bump: u8,
}
#[account]
#[derive(InitSpace)]
pub struct PassportVersion {
    pub track: Pubkey,
    pub version: u32,
    pub previous_hash: [u8; 32],
    pub manifest_hash: [u8; 32],
    pub recorded_at: i64,
}
