import httpx
from typing import Optional, List
from ..config import settings


class NotificationService:
    """Service for sending push notifications and webhooks."""
    
    FCM_URL = "https://fcm.googleapis.com/fcm/send"
    
    @classmethod
    async def send_push_notification(
        cls,
        token: str,
        title: str,
        body: str,
        data: Optional[dict] = None
    ) -> bool:
        """Send push notification via FCM."""
        # FCM server key would be in environment
        fcm_key = settings.config.get("FCM_SERVER_KEY")
        
        if not fcm_key:
            print(f"FCM not configured. Notification: {title}")
            return False
        
        payload = {
            "to": token,
            "notification": {
                "title": title,
                "body": body,
                "sound": "default"
            },
            "data": data or {}
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    cls.FCM_URL,
                    json=payload,
                    headers={"Authorization": f"key={fcm_key}"},
                    timeout=10
                )
                return response.status_code == 200
            except Exception as e:
                print(f"Push notification failed: {e}")
                return False
    
    @classmethod
    async def send_webhook(
        cls,
        url: str,
        payload: dict,
        secret: Optional[str] = None
    ) -> bool:
        """Send webhook notification to insurance company."""
        import hmac
        import hashlib
        import json
        
        headers = {"Content-Type": "application/json"}
        
        # Add signature if secret is provided
        if secret:
            body = json.dumps(payload)
            signature = hmac.new(
                secret.encode(),
                body.encode(),
                hashlib.sha256
            ).hexdigest()
            headers["X-SafeRoad-Signature"] = signature
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    url,
                    json=payload,
                    headers=headers,
                    timeout=15
                )
                return response.status_code in [200, 201, 202]
            except Exception as e:
                print(f"Webhook failed: {e}")
                return False
    
    @classmethod
    def create_alert_payload(
        cls,
        pothole_data: dict,
        alert_type: str = "new_pothole"
    ) -> dict:
        """Create standardized alert payload for webhooks and notifications."""
        return {
            "type": alert_type,
            "timestamp": pothole_data.get("reported_at"),
            "pothole": {
                "id": str(pothole_data["id"]),
                "latitude": pothole_data["latitude"],
                "longitude": pothole_data["longitude"],
                "severity": pothole_data["severity"],
                "risk_score": pothole_data.get("risk_score", 5.0),
                "image_url": pothole_data.get("image_url"),
                "road_name": pothole_data.get("road_name"),
                "city": pothole_data.get("city", "Mumbai")
            },
            "meta": {
                "source": pothole_data.get("source", "mobile"),
                "confidence": pothole_data.get("confidence", 0.8)
            }
        }
    
    @classmethod
    async def broadcast_to_subscribers(
        cls,
        subscribers: List[dict],
        pothole_data: dict
    ) -> dict:
        """Broadcast pothole alert to matching subscribers."""
        results = {
            "webhooks_sent": 0,
            "webhooks_failed": 0,
            "push_sent": 0,
            "push_failed": 0
        }
        
        payload = cls.create_alert_payload(pothole_data)
        severity = pothole_data.get("severity", 1)
        city = pothole_data.get("city", "")
        
        for subscriber in subscribers:
            filters = subscriber.get("filters", {})
            
            # Check filters
            if filters.get("severity_min") and severity < filters["severity_min"]:
                continue
            if filters.get("city") and city != filters["city"]:
                continue
            
            # Send webhook
            webhook_url = subscriber.get("webhook_url")
            if webhook_url:
                success = await cls.send_webhook(
                    webhook_url,
                    payload,
                    subscriber.get("secret_key")
                )
                if success:
                    results["webhooks_sent"] += 1
                else:
                    results["webhooks_failed"] += 1
            
            # Send push notification
            device_token = subscriber.get("device_token")
            if device_token:
                success = await cls.send_push_notification(
                    device_token,
                    f"⚠️ Pothole Alert - Severity {severity}",
                    f"Near {pothole_data.get('road_name', 'Unknown Road')}",
                    payload
                )
                if success:
                    results["push_sent"] += 1
                else:
                    results["push_failed"] += 1
        
        return results
