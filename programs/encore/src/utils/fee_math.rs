use crate::constants::BPS_DENOMINATOR;
use crate::errors::EncoreError;
use anchor_lang::prelude::*;

/// Computes floor(amount * bps / 10_000) using checked u128 intermediate math.
pub fn compute_bps_fee(amount: u64, bps: u64) -> Result<u64> {
    let product = (amount as u128)
        .checked_mul(bps as u128)
        .ok_or(EncoreError::MathOverflow)?;
    let fee = product
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(EncoreError::MathOverflow)?;
    u64::try_from(fee).map_err(|_| EncoreError::MathOverflow.into())
}
