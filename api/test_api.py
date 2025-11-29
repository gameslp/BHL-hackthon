import requests
import json

# Test coordinates (example)
test_data = {
    "centroidLat": 51.8431,
    "centroidLng": 16.5333
}

# Make request
response = requests.post(
    "http://localhost:8000/predict",
    json=test_data
)

print("Status Code:", response.status_code)
print("Response:", json.dumps(response.json(), indent=2))
