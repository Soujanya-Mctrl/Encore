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
