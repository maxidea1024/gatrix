import json

def parse_transcript():
    path = r'C:\Users\jhseo\.gemini\antigravity-ide\brain\1b845696-cd30-4cc0-be81-f6e757ab4877\.system_generated\logs\transcript.jsonl'
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                data = json.loads(line)
                if 'tool_calls' in data:
                    for tc in data['tool_calls']:
                        if tc['name'] in ('replace_file_content', 'multi_replace_file_content'):
                            args = tc.get('args', {})
                            if 'ArgusIssueDetailPage.tsx' in args.get('TargetFile', ''):
                                print(f"--- STEP {data.get('step_index')} ---")
                                print("Instruction:", args.get('Instruction', args.get('Description', '')))
            except Exception as e:
                pass

if __name__ == '__main__':
    parse_transcript()
