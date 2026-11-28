use crate::errors::EncoreError;
use crate::state::{PassStatus, Track};
use anchor_lang::prelude::*;

pub fn assert_passport_eligible(
    track: &Track,
    expected_version: u32,
    expected_manifest_hash: [u8; 32],
) -> Result<()> {
    require!(!track.paused, EncoreError::TrackPaused);
    require!(
        track.current_version == expected_version
            && track.current_manifest_hash == expected_manifest_hash,
        EncoreError::StalePassportVersion
    );
    Ok(())
}

pub fn assert_pass_non_terminal(status: PassStatus) -> Result<()> {
    require!(
        status != PassStatus::Redeemed && status != PassStatus::Expired,
        EncoreError::TerminalPassState
    );
    Ok(())
}
