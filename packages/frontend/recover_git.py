import json

def parse_git():
    path = r'C:\Users\jhseo\.gemini\antigravity-ide\brain\1b845696-cd30-4cc0-be81-f6e757ab4877\.system_generated\logs\transcript.jsonl'
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                data = json.loads(line)
                if 'tool_calls' in data:
                    for tc in data['tool_calls']:
                        if tc['name'] == 'run_command':
                            cmd = tc.get('args', {}).get('CommandLine', '')
                            if 'git' in cmd:
                                print(f"Step {data.get('step_index')}: {cmd}")
            except Exception as e:
                pass

if __name__ == '__main__':
    parse_git()
