#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;
pub mod utils;
pub mod validation;

declare_id!("11111111111111111111111111111111");

#[program]
pub mod encore {
    use super::*;

    pub fn initialize_placeholder(_ctx: Context<InitializePlaceholder>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializePlaceholder {}
