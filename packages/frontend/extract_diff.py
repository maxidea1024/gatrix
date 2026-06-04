import json

def parse_diffs():
    path = r'C:\Users\jhseo\.gemini\antigravity-ide\brain\1b845696-cd30-4cc0-be81-f6e757ab4877\.system_generated\logs\transcript.jsonl'
    target_steps = [1874, 1910, 1964, 1970, 2042]
    
    with open('diff_output.txt', 'w', encoding='utf-8') as out:
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    data = json.loads(line)
                    step = data.get('step_index')
                    if step in target_steps and 'tool_calls' in data:
                        for tc in data['tool_calls']:
                            if tc['name'] == 'replace_file_content':
                                args = tc.get('args', {})
                                out.write(f"\n--- STEP {step} (replace_file_content) ---\n")
                                out.write("TARGET:\n")
                                out.write(args.get('TargetContent', '') + '\n')
                                out.write("REPLACEMENT:\n")
                                out.write(args.get('ReplacementContent', '') + '\n')
                            elif tc['name'] == 'multi_replace_file_content':
                                chunks = tc.get('args', {}).get('ReplacementChunks', [])
                                if isinstance(chunks, str):
                                    chunks = json.loads(chunks)
                                out.write(f"\n--- STEP {step} (multi) ---\n")
                                for i, chunk in enumerate(chunks):
                                    out.write(f"CHUNK {i}:\n")
                                    out.write("TARGET:\n")
                                    out.write(chunk.get('TargetContent', '') + '\n')
                                    out.write("REPLACEMENT:\n")
                                    out.write(chunk.get('ReplacementContent', '') + '\n')
                except Exception as e:
                    pass

if __name__ == '__main__':
    parse_diffs()
