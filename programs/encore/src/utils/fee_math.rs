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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn floors_smallest_unit_fees() {
        assert_eq!(compute_bps_fee(101, 500).unwrap(), 5);
        assert_eq!(compute_bps_fee(19, 500).unwrap(), 0);
        assert_eq!(compute_bps_fee(0, 500).unwrap(), 0);
    }

    #[test]
    fn resale_split_conserves_every_unit() {
        for amount in [1, 19, 101, 20_000_000, u64::MAX] {
            let artist = compute_bps_fee(amount, 1000).unwrap();
            let platform = compute_bps_fee(amount, 500).unwrap();
            let seller = amount - artist - platform;
            assert_eq!(
                seller as u128 + artist as u128 + platform as u128,
                amount as u128
            );
        }
    }

    #[test]
    fn rejects_result_overflow() {
        assert!(compute_bps_fee(u64::MAX, u64::MAX).is_err());
    }
}
