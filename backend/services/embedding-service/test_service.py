#!/usr/bin/env python3
"""
Simple test script to verify the embedding service is working correctly.
"""

import requests
import json
import time


def test_health_endpoint():
    """Test the health check endpoint."""
    print("Testing health endpoint...")
    try:
        response = requests.get("http://localhost:8000/health", timeout=5)
        if response.status_code == 200:
            print("✅ Health check passed:", response.json())
            return True
        else:
            print("❌ Health check failed:", response.status_code, response.text)
            return False
    except Exception as e:
        print("❌ Health check error:", str(e))
        return False


def test_embedding_endpoint():
    """Test the embedding generation endpoint."""
    print("\nTesting embedding endpoint...")
    test_data = {"texts": ["Hello world", "This is a test problem"], "role": "passage"}

    try:
        response = requests.post(
            "http://localhost:8000/embed", json=test_data, timeout=30
        )

        if response.status_code == 200:
            result = response.json()
            print("✅ Embedding generation successful!")
            print(f"   Generated {len(result['vectors'])} embeddings")
            print(f"   Embedding dimension: {len(result['vectors'][0])}")
            return True
        else:
            print(
                "❌ Embedding generation failed:", response.status_code, response.text
            )
            return False
    except Exception as e:
        print("❌ Embedding generation error:", str(e))
        return False


def test_invalid_input():
    """Test error handling with invalid input."""
    print("\nTesting error handling...")
    test_data = {"texts": []}

    try:
        response = requests.post(
            "http://localhost:8000/embed", json=test_data, timeout=5
        )
        if response.status_code == 400:
            print("✅ Error handling works correctly")
            return True
        else:
            print("❌ Unexpected response for invalid input:", response.status_code)
            return False
    except Exception as e:
        print("❌ Error handling test error:", str(e))
        return False


def main():
    """Run all tests."""
    print("🧪 Testing MathComps Embedding Service")
    print("=" * 40)

    # Test 1: Health check
    health_ok = test_health_endpoint()

    # Test 2: Embedding generation
    embedding_ok = test_embedding_endpoint()

    # Test 3: Error handling
    error_handling_ok = test_invalid_input()

    print("\n" + "=" * 40)
    print("📊 Test Summary:")
    print(f"   Health Check: {'✅ PASS' if health_ok else '❌ FAIL'}")
    print(f"   Embedding Generation: {'✅ PASS' if embedding_ok else '❌ FAIL'}")
    print(f"   Error Handling: {'✅ PASS' if error_handling_ok else '❌ FAIL'}")

    if health_ok and embedding_ok and error_handling_ok:
        print("\n🎉 All tests passed! The service is working correctly.")
        return 0
    else:
        print("\n⚠️  Some tests failed. Please check the service configuration.")
        return 1


if __name__ == "__main__":
    exit(main())
