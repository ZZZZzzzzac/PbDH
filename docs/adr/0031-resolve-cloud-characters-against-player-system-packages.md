# Resolve Cloud Characters against Player System Packages

Status: accepted

Cloud Sync stores each Character Save and its recorded System Package ID and version, but it does not upload or distribute the System Package itself. When Player App opens a cloud Character Save, it first resolves the Package ID against the Current System Package and the App's explicit Preset System Package registry.

If Current System Package has the required ID, Player App uses it. If a Preset System Package has the required ID, Player App switches to that preset through the existing preset loader, validator, cache, and activation workflow. If the ID is unknown, Player App retains the Character Save and reports that the user must manually import the required System Package; it does not guess a replacement, query Market, or open the character without its package.

After a matching package is active, differences between the Character Save's recorded package version and the active package version follow the mature Sheet projection and diagnostic behavior. Cloud Sync does not introduce a second Character compatibility rule.

## Consequences

- Character cloud sync is useful across devices for preset rules without turning account storage into a System Package distribution service.
- A cloud Character Save can exist in the local/cloud list while temporarily unavailable for opening because its System Package is missing or failed validation.
- Automatic preset switching succeeds only after the preset package loads and validates. A load failure preserves both the existing Current System Package and the Character Save.
- Manual import must produce a valid System Package with the required stable ID before the character can open; ordinary version projection and diagnostics then decide how its saved data loads.
- Market is not a fallback for missing System Packages because Market does not distribute them.
