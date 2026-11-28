use anchor_lang::prelude::Pubkey;
use anchor_lang::solana_program::hash::hashv;

const DISTRIBUTION_LEAF_DOMAIN: &[u8] = b"encore:dist_claim:v1";

pub fn distribution_leaf(claimer: &Pubkey, amount: u64) -> [u8; 32] {
    hashv(&[
        DISTRIBUTION_LEAF_DOMAIN,
        claimer.as_ref(),
        &amount.to_le_bytes(),
    ])
    .to_bytes()
}

pub fn verify_merkle_proof(proof: &[[u8; 32]], root: [u8; 32], leaf: [u8; 32]) -> bool {
    let mut computed = leaf;
    for node in proof {
        computed = if computed <= *node {
            hashv(&[&computed, node]).to_bytes()
        } else {
            hashv(&[node, &computed]).to_bytes()
        };
    }
    computed == root
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn verifies_single_and_multi_leaf_merkle_proofs() {
        let a = Pubkey::new_unique();
        let b = Pubkey::new_unique();
        let leaf_a = distribution_leaf(&a, 2_500_000);
        let leaf_b = distribution_leaf(&b, 7_500_000);

        // Single-leaf root
        assert!(verify_merkle_proof(&[], leaf_a, leaf_a));
        assert!(!verify_merkle_proof(&[], leaf_a, leaf_b));

        // Two-leaf tree
        let root = if leaf_a <= leaf_b {
            hashv(&[&leaf_a, &leaf_b]).to_bytes()
        } else {
            hashv(&[&leaf_b, &leaf_a]).to_bytes()
        };
        assert!(verify_merkle_proof(&[leaf_b], root, leaf_a));
        assert!(verify_merkle_proof(&[leaf_a], root, leaf_b));
        assert!(!verify_merkle_proof(
            &[leaf_b],
            root,
            distribution_leaf(&a, 2_500_001)
        ));
    }
}
