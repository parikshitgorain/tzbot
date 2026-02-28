#!/usr/bin/env python3
import re

file_path = '/var/www/tzbot/current/dist/ai/ai-manager.js'

with open(file_path, 'r') as f:
    content = f.read()

# Replace unescaped asterisks in profanity words
replacements = [
    ("'f*ck'", "'f\\*ck'"),
    ("'sh*t'", "'sh\\*t'"),
    ("'b*tch'", "'b\\*tch'"),
    ("'a**'", "'a\\*\\*'"),
    ("'d*mn'", "'d\\*mn'"),
    ("'h*ll'", "'h\\*ll'"),
    ("'f**k'", "'f\\*\\*k'"),
    ("'s**t'", "'s\\*\\*t'"),
    ("'b**ch'", "'b\\*\\*ch'"),
    ("'a**hole'", "'a\\*\\*hole'"),
]

for old, new in replacements:
    content = content.replace(old, new)

with open(file_path, 'w') as f:
    f.write(content)

print('Fixed regex patterns in ai-manager.js')
