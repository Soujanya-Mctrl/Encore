use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum SeriesStatus {
    Active,
    Paused,
    Closed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum PassStatus {
    Offered,
    Owned,
    Listed,
    Redeemed,
    Expired,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum CampaignStatus {
    Funding,
    Funded,
    Failed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum OpinionOutcome {
    Unresolved,
    Yes,
    No,
}

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

#[account]
#[derive(InitSpace)]
pub struct PassSeries {
    pub artist: Pubkey,
    pub track: Pubkey,
    pub terms_hash: [u8; 32],
    pub benefit_hash: [u8; 32],
    pub mint: Pubkey,
    pub cap: u32,
    pub issued: u32,
    pub primary_price: u64,
    pub expiry: i64,
    pub primary_fee_bps: u16,
    pub resale_artist_bps: u16,
    pub resale_fee_bps: u16,
    pub platform_wallet: Pubkey,
    pub status: SeriesStatus,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct SupporterPass {
    pub series: Pubkey,
    pub serial: u32,
    pub owner: Pubkey,
    pub status: PassStatus,
    pub nonce: u64,
    pub listing_price: u64,
    pub listing_expiry: i64,
}

#[account]
#[derive(InitSpace)]
pub struct SupportReceipt {
    pub payer: Pubkey,
    pub nonce: u64,
    pub track: Pubkey,
    pub version: u32,
    pub manifest_hash: [u8; 32],
    pub amount: u64,
    pub recipient: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Campaign {
    pub artist: Pubkey,
    pub track: Pubkey,
    pub campaign_id_hash: [u8; 32],
    pub terms_hash: [u8; 32],
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub goal: u64,
    pub raised: u64,
    pub released_amount: u64,
    pub share_supply: u64,
    pub deadline: i64,
    pub status: CampaignStatus,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct CampaignPledge {
    pub campaign: Pubkey,
    pub payer: Pubkey,
    pub nonce: u64,
    pub amount: u64,
    pub refunded: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct SpotListing {
    pub campaign: Pubkey,
    pub seller: Pubkey,
    pub listing_id_hash: [u8; 32],
    pub mint: Pubkey,
    pub total_units: u32,
    pub remaining_units: u32,
    pub unit_price: u64,
    pub nonce: u64,
    pub active: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct DistributionCycle {
    pub campaign: Pubkey,
    pub authority: Pubkey,
    pub cycle_id_hash: [u8; 32],
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub evidence_hash: [u8; 32],
    pub merkle_root: [u8; 32],
    pub verified_revenue: u64,
    pub claimed_amount: u64,
    pub total_supply_snapshot: u64,
    pub open: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct DistributionClaim {
    pub cycle: Pubkey,
    pub claimer: Pubkey,
    pub amount: u64,
    pub claimed_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct OpinionMarket {
    pub campaign: Pubkey,
    pub mint: Pubkey,
    pub prediction_vault: Pubkey,
    pub trading_cutoff: i64,
    pub yes_pairs: u64,
    pub no_pairs: u64,
    pub outcome: OpinionOutcome,
    pub bump: u8,
}
