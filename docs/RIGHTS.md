# Rights inventory — owner review required

Audit baseline: `d1877a6` (2026-07-13), reviewed 2026-10-19.

- The root README stated “MIT”; no root LICENSE or copyright holder declaration was present. Confirm the intended scope and ownership before adding license text. No new grant is made here.
- `skills-lock.json` attributes bundled `.agents/skills/` material to `Leonxlnx/taste-skill`. The audited copy did not carry an accompanying upstream license file. On 2026-10-19 the upstream default branch reports MIT; its license blob is `48a2f6640b81ff8eca9ce7f6a96337692713ef5b`, copied to [third-party/taste-skill-LICENSE.txt](third-party/taste-skill-LICENSE.txt). The source revision used for the bundled skills is not recorded, so confirm the applicable license at that revision or remove nonessential copies. A computed content hash is not a source revision or a rights clearance.
- Runtime and development dependencies have their own licenses in the installed packages; a lockfile records versions but does not replace their notices. Review the distribution contents before publishing a package or container.
- Product names, provider endpoints and generated schemas do not imply endorsement or certification by Alipay, Dify, Coze, Coinbase or FLOP.

This inventory records unresolved ownership and notice questions; it is not a rights clearance or legal opinion.
