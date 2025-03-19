#!/bin/bash

# Check if host is provided as a command line argument
if [ -z "$1" ]; then
  echo "Usage: $0 <host>"
  echo "Example: $0 http://localhost:3000"
  exit 1
fi
host=$1

echo Simulating traffic to $host...

# Function to cleanly exit
cleanup() {
  echo "Terminating background processes..."
  kill $pid1 $pid2 $pid3 $pid4
  exit 0
}

# Trap SIGINT (Ctrl+C) to execute the cleanup function
trap cleanup SIGINT

while true; do
  echo "Getting menu..."
  curl -s "$host/api/order/menu" > /dev/null
  sleep $((RANDOM % 2 + 3))
done &
pid1=$!

while true; do
  echo "Failed login attempt..."
  curl -s -X PUT $host/api/auth -d '{"email":"unknown@jwt.com", "password":"bad"}' -H 'Content-Type: application/json' > /dev/null
  sleep $((RANDOM % 20 + 25))
done &
pid2=$!

while true; do
  echo "Logging in as franchisee..."
  response=$(curl -s -X PUT $host/api/auth -d '{"email":"f@jwt.com", "password":"franchisee"}' -H 'Content-Type: application/json')
  token=$(echo $response | jq -r '.token')
  sleep 110
  echo "Logging out franchisee..."
  curl -X DELETE $host/api/auth -H "Authorization: Bearer $token"
  sleep 10
done &
pid3=$!

while true; do
  echo "Logging in as diner..."
  response=$(curl -s -X PUT $host/api/auth -d '{"email":"d@jwt.com", "password":"diner"}' -H 'Content-Type: application/json')
  token=$(echo $response | jq -r '.token')
  echo "Placing order..."
  curl -s -X POST $host/api/order -H 'Content-Type: application/json' -d '{"franchiseId": 1, "storeId":1, "items":[{ "menuId": 1, "description": "Veggie", "price": 0.05 }]}'  -H "Authorization: Bearer $token" > /dev/null
  sleep 20
  echo "Logging out diner..."
  curl -X DELETE $host/api/auth -H "Authorization: Bearer $token"
  sleep 30
done &
pid4=$!

# Wait for the background processes to complete
wait $pid1 $pid2 $pid3 $pid4