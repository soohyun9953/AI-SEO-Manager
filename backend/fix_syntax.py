import re

with open('main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 260번 줄의 문제 있는 f-string 수정
old_line = "        prompt = f\"'{category}' 분야에서 최신 트렌드 기준 수익성 높은 블로그 주제 3개를 JSON 형식으로 추천해줘. [{\\\"topic\\\": \\\"...\\\", \\\"reason\\\": \\\"...\\\"}]\""
new_line = '        json_format = \'[{"topic": "...", "reason": "..."}]\'\n        prompt = f"\'{category}\' 분야에서 최신 트렌드 기준 수익성 높은 블로그 주제 3개를 JSON 형식으로 추천해줘. {json_format}"'

if old_line in content:
    content = content.replace(old_line, new_line)
    with open('main.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print("수정 완료!")
else:
    # 라인 번호로 직접 찾아서 수정
    lines = content.splitlines(keepends=True)
    for i, line in enumerate(lines):
        if '주제_생성' in line and 'def' in line:
            print(f"def 위치: {i+1}번째 줄")
        if 'JSON 형식으로 추천해줘' in line:
            print(f"대상 줄 발견: {i+1}번째 줄")
            print(repr(line))
            lines[i] = '        json_format = \'[{"topic": "...", "reason": "..."}]\'\n        prompt = f"\'{category}\' 분야에서 최신 트렌드 기준 수익성 높은 블로그 주제 3개를 JSON 형식으로 추천해줘. {json_format}"\n'
            with open('main.py', 'w', encoding='utf-8') as f:
                f.writelines(lines)
            print("라인 단위 수정 완료!")
            break
    else:
        print("대상 라인을 찾을 수 없습니다.")
