import urllib.request, json
data=json.dumps({'keyword':'test', 'topic':'test'}).encode()
req=urllib.request.Request('http://127.0.0.1:8002/api/keywords/deep-analyze', data=data, headers={'Content-Type': 'application/json', 'X-Gemini-Key': ''}, method='POST')
try: urllib.request.urlopen(req)
except Exception as e: print(e.read().decode())
