use crate::state::CampaignStatus;
use anchor_lang::prelude::*;

#[event]
pub struct SupportReceiptEvent {
    pub payer: Pubkey,
    pub track: Pubkey,
    pub version: u32,
    pub manifest_hash: [u8; 32],
    pub amount: u64,
    pub recipient: Pubkey,
    pub nonce: u64,
}

#[event]
pub struct SeriesCreatedEvent {
    pub series: Pubkey,
    pub artist: Pubkey,
    pub track: Pubkey,
    pub mint: Pubkey,
    pub cap: u32,
    pub primary_price: u64,
    pub expiry: i64,
}

#[event]
pub struct PassPurchasedEvent {
    pub series: Pubkey,
    pub pass: Pubkey,
    pub serial: u32,
    pub buyer: Pubkey,
    pub artist_payout: u64,
    pub platform_fee: u64,
    pub version: u32,
    pub manifest_hash: [u8; 32],
}

#[event]
pub struct PassListedEvent {
    pub series: Pubkey,
    pub pass: Pubkey,
    pub owner: Pubkey,
    pub listing_price: u64,
    pub listing_expiry: i64,
    pub nonce: u64,
}

#[event]
pub struct PassListingCancelledEvent {
    pub series: Pubkey,
    pub pass: Pubkey,
    pub owner: Pubkey,
    pub nonce: u64,
}

#[event]
pub struct PassResoldEvent {
    pub series: Pubkey,
    pub pass: Pubkey,
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub price: u64,
    pub seller_payout: u64,
    pub artist_fee: u64,
    pub platform_fee: u64,
    pub nonce: u64,
    pub version: u32,
    pub manifest_hash: [u8; 32],
}

#[event]
pub struct PassRedeemedEvent {
    pub series: Pubkey,
    pub pass: Pubkey,
    pub owner: Pubkey,
    pub nonce: u64,
}

#[event]
pub struct PassExpiredEvent {
    pub series: Pubkey,
    pub pass: Pubkey,
    pub nonce: u64,
}

#[event]
pub struct CampaignCreatedEvent {
    pub campaign: Pubkey,
    pub artist: Pubkey,
    pub track: Pubkey,
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub goal: u64,
    pub share_supply: u64,
    pub deadline: i64,
}

#[event]
pub struct CampaignPledgedEvent {
    pub campaign: Pubkey,
    pub pledge: Pubkey,
    pub payer: Pubkey,
    pub amount: u64,
    pub total_raised: u64,
    pub status: CampaignStatus,
}

#[event]
pub struct CampaignMilestoneReleasedEvent {
    pub campaign: Pubkey,
    pub milestone_index: u32,
    pub amount: u64,
    pub recipient: Pubkey,
    pub total_released: u64,
}

#[event]
pub struct CampaignRefundedEvent {
    pub campaign: Pubkey,
    pub pledge: Pubkey,
    pub claimer: Pubkey,
    pub amount: u64,
}

#[event]
pub struct SpotListingCreatedEvent {
    pub listing: Pubkey,
    pub campaign: Pubkey,
    pub seller: Pubkey,
    pub units: u32,
    pub unit_price: u64,
}

#[event]
pub struct SpotListingCancelledEvent {
    pub listing: Pubkey,
    pub campaign: Pubkey,
    pub seller: Pubkey,
    pub nonce: u64,
}

#[event]
pub struct SpotFilledEvent {
    pub listing: Pubkey,
    pub campaign: Pubkey,
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub units: u32,
    pub unit_price: u64,
    pub total_amount: u64,
    pub remaining_units: u32,
    pub nonce: u64,
}

#[event]
pub struct DistributionCycleOpenedEvent {
    pub cycle: Pubkey,
    pub campaign: Pubkey,
    pub vault: Pubkey,
    pub verified_revenue: u64,
    pub merkle_root: [u8; 32],
    pub total_supply_snapshot: u64,
}

#[event]
pub struct DistributionClaimedEvent {
    pub cycle: Pubkey,
    pub claimer: Pubkey,
    pub amount: u64,
    pub total_claimed: u64,
}
