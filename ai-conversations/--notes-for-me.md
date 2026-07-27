##TESTING COMMANDS
access redis-cli: 
`docker exec -it digital-deck-redis redis-cli`

check number of seconds left before session key auto-expires
access redis-cli + `TTL session:<sessionId>:meta`



get session id: 
`curl http://localhost:8080/api/sessions/{code}`

Bypass the UI entirely — curl a draw for the wrong player
curl -X POST http://localhost:8080/api/sessions/<sessionId>/draw \
  -H "Content-Type: application/json" \
  -d '{"playerId": "not-a-real-player"}'
  