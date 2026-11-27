console.error(`${process.argv[2] ?? "Command"} belongs to a later phase and has not been implemented. See docs/planning/BUILD_PLAN_48H.md.`);
process.exitCode = 1;
