with open('src/pages/teacher/TeacherClasses.jsx', 'r') as f:
    lines = f.readlines()

# The bulk marks block is exactly from line 922 to 1089 (0-indexed 921 to 1089, len=168)
block = lines[921:1089]

# Insert iPad min/max tags around line 1038 (which is inside the block)
for i, l in enumerate(block):
    if 'type="number"' in l and 'bulkMaxMarks' not in l:
        # Check if it's the one in the table by surrounding context
        if 'className={`w-24 px-3 py-2 border' in block[i+1]:
            block[i] = l + '                                                            min="0"\n                                                            max={bulkMaxMarks || \'\'}\n'

# Verify block
if "{activeTab === 'bulk-marks' && (" not in block[0]:
    print("Block start mismatch")
    import sys; sys.exit(1)
if ")}" not in block[-1]:
    print("Block end mismatch")
    import sys; sys.exit(1)

# Delete the block from original positions
del lines[921:1089]

# Insert before line 914 (0-indexed 913)
# 913 is the `</div>` closing `div.p-6`
lines = lines[:913] + block + lines[913:]

# Fix </main> to </div>
for i, l in enumerate(lines):
    if "</main>" in l:
        lines[i] = l.replace("</main>", "</div>")

with open('src/pages/teacher/TeacherClasses.jsx', 'w') as f:
    f.writelines(lines)

print("Shift successful!")
