use anchor_lang::prelude::*;

#[error_code]
pub enum EncoreError {
    #[msg("Arithmetic overflow or underflow")]
    MathOverflow,
    #[msg("Track is currently paused due to a dispute or moderation action")]
    TrackPaused,
    #[msg("Stale passport version or manifest hash mismatch")]
    StalePassportVersion,
    #[msg("Supporter pass supply cap reached")]
    SupplyCapReached,
    #[msg("Supporter pass is in a terminal state")]
    TerminalPassState,
    #[msg("Unauthorized signer")]
    Unauthorized,
    #[msg("Invalid amount or zero price")]
    InvalidAmount,
    #[msg("Campaign is not funded")]
    CampaignNotFunded,
    #[msg("Campaign deadline has not passed or goal was met")]
    CampaignStillActive,
    #[msg("Campaign pledge refund already claimed")]
    RefundAlreadyClaimed,
    #[msg("Invalid distribution Merkle proof")]
    InvalidMerkleProof,
    #[msg("Distribution cycle is closed or exhausted")]
    DistributionClosed,
    #[msg("Spot listing is inactive or lacks requested units")]
    SpotListingInactive,
}
