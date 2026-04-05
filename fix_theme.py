import os
import re

directories = [
    "src/components/dashboard",
    "src/components/budget",
    "src/app/(dashboard)",
]

replacements = [
    # text-white to text-neutral-900 dark:text-white
    (r'\btext-white\b', 'text-neutral-900 dark:text-white'),
    # bg-white/5 to bg-white/80 dark:bg-white/5
    (r'\bbg-white/5\b', 'bg-white/60 dark:bg-white/5'),
    # border-white/10 to border-neutral-200 dark:border-white/10
    (r'\bborder-white/10\b', 'border-neutral-200 dark:border-white/10'),
    # text-neutral-400 to text-neutral-600 dark:text-neutral-400
    (r'\btext-neutral-400\b', 'text-neutral-600 dark:text-neutral-400'),
    # text-neutral-200 to text-neutral-800 dark:text-neutral-200
    (r'\btext-neutral-200\b', 'text-neutral-800 dark:text-neutral-200'),
    # text-neutral-300 to text-neutral-700 dark:text-neutral-300
    (r'\btext-neutral-300\b', 'text-neutral-700 dark:text-neutral-300'),
    # bg-white/[0.02] to bg-neutral-100 dark:bg-white/[0.02]
    (r'\bbg-white/\[0\.02\]\b', 'bg-neutral-50 dark:bg-white/[0.02]'),
    # bg-white/[0.03] to bg-neutral-100 dark:bg-white/[0.03]
    (r'\bbg-white/\[0\.03\]\b', 'bg-neutral-100 dark:bg-white/[0.03]'),
    # bg-white/[0.04] to bg-neutral-100 dark:bg-white/[0.04]
    (r'\bbg-white/\[0\.04\]\b', 'bg-neutral-100 dark:bg-white/[0.04]'),
    # hover:bg-white/10 to hover:bg-neutral-100 dark:hover:bg-white/10
    (r'\bhover:bg-white/10\b', 'hover:bg-neutral-100 dark:hover:bg-white/10'),
    # bg-neutral-900 to bg-white dark:bg-neutral-900
    (r'\bbg-neutral-900\b', 'bg-white dark:bg-neutral-950'),
]

# Specifically we don't want to replace text-white twice if somehow it matches.
# But regex boundaries \b should handle it. Let's make sure.
# Wait, "dark:text-neutral-900 dark:text-white" could happen if we run it twice.

def process_file(filepath):
    if not filepath.endswith('.tsx') and not filepath.endswith('.ts'):
        return

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    for old, new in replacements:
        # Avoid double replacing if it's already there
        if "dark:" in old:
            continue
        # We only replace if the string is standalone (not already prefixed with dark:)
        # We can use regex negative lookbehind if needed.
        # (?<!dark:)(?<!\w)old
        pattern = r'(?<!dark:)' + old
        content = re.sub(pattern, new, content)

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {filepath}")

for d in directories:
    for root, _, files in os.walk(d):
        for file in files:
            process_file(os.path.join(root, file))

print("Done")
