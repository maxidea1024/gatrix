use std::process::{Command, Stdio};

fn emit_release_var() {
    // Try to get git revision, fall back to "unknown" if .git is not available
    let ver = Command::new("git")
        .args(["rev-parse", "HEAD"])
        .stderr(Stdio::null())
        .output()
        .ok()
        .filter(|cmd| cmd.status.success())
        .map(|cmd| String::from_utf8_lossy(&cmd.stdout).trim().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    println!("cargo:rustc-env=SYMBOLICATOR_RELEASE={ver}");
    println!("cargo:rerun-if-env-changed=SYMBOLICATOR_RELEASE");
}

fn main() {
    emit_release_var();
}
