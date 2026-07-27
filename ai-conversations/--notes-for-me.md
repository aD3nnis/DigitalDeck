##TESTING COMMANDS
access redis-cli: 
`docker exec -it digital-deck-redis redis-cli`

check number of seconds left before session key auto-expires
access redis-cli + `TTL session:<sessionId>:meta`
