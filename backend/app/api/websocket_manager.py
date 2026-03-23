import json
import asyncio
from typing import Dict, Set, Optional, List
from fastapi import WebSocket
from datetime import datetime
import redis.asyncio as redis


class ConnectionManager:
    """
    Manages WebSocket connections for real-time updates.
    
    Supports:
    - Area-based subscriptions (H3 cells)
    - User-specific alerts
    - Broadcast to all connections
    """
    
    def __init__(self):
        # Map of h3_index -> set of websocket connections
        self.area_connections: Dict[str, Set[WebSocket]] = {}
        
        # Map of user_id -> websocket connection
        self.user_connections: Dict[str, WebSocket] = {}
        
        # All active connections (for broadcasts)
        self.all_connections: Set[WebSocket] = set()
        
        # Redis client for pub/sub (optional)
        self.redis_client: Optional[redis.Redis] = None
        self.pubsub: Optional[redis.client.PubSub] = None
        
        # Heartbeat task
        self._heartbeat_task: Optional[asyncio.Task] = None
    
    async def connect_redis(self, redis_url: str):
        """Connect to Redis for distributed pub/sub."""
        try:
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
            self.pubsub = self.redis_client.pubsub()
            await self.pubsub.subscribe("safaroad:potholes")
            print("Connected to Redis for WebSocket pub/sub")
        except Exception as e:
            print(f"Redis connection failed: {e}")
            self.redis_client = None
    
    async def start(self):
        """Start the connection manager."""
        if self._heartbeat_task is None:
            self._heartbeat_task = asyncio.create_task(self._heartbeat())
        
        if self.redis_client:
            asyncio.create_task(self._redis_listener())
    
    async def stop(self):
        """Stop the connection manager."""
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            self._heartbeat_task = None
        
        if self.pubsub:
            await self.pubsub.unsubscribe("safaroad:potholes")
        
        if self.redis_client:
            await self.redis_client.close()
    
    async def connect(
        self, 
        websocket: WebSocket,
        h3_index: Optional[str] = None,
        user_id: Optional[str] = None
    ):
        """Accept and register a new WebSocket connection."""
        await websocket.accept()
        
        self.all_connections.add(websocket)
        
        if h3_index:
            if h3_index not in self.area_connections:
                self.area_connections[h3_index] = set()
            self.area_connections[h3_index].add(websocket)
        
        if user_id:
            self.user_connections[user_id] = websocket
        
        print(f"WebSocket connected. Total: {len(self.all_connections)}")
    
    async def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection."""
        self.all_connections.discard(websocket)
        
        # Remove from area connections
        for h3_index in list(self.area_connections.keys()):
            self.area_connections[h3_index].discard(websocket)
            if not self.area_connections[h3_index]:
                del self.area_connections[h3_index]
        
        # Remove from user connections
        for user_id in list(self.user_connections.keys()):
            if self.user_connections[user_id] == websocket:
                del self.user_connections[user_id]
        
        print(f"WebSocket disconnected. Total: {len(self.all_connections)}")
    
    async def send_personal_message(self, message: dict, user_id: str):
        """Send message to a specific user."""
        websocket = self.user_connections.get(user_id)
        if websocket:
            try:
                await websocket.send_json(message)
                return True
            except Exception:
                await self.disconnect(websocket)
        return False
    
    async def send_to_area(self, message: dict, h3_index: str):
        """Send message to all connections in an area."""
        connections = self.area_connections.get(h3_index, set())
        disconnected = []
        
        for websocket in connections:
            try:
                await websocket.send_json(message)
            except Exception:
                disconnected.append(websocket)
        
        # Cleanup disconnected
        for ws in disconnected:
            await self.disconnect(ws)
    
    async def send_to_neighbors(self, message: dict, h3_index: str, ring: int = 1):
        """Send message to neighboring H3 cells."""
        import h3
        
        neighbors = h3.grid_disk(h3_index, ring)
        
        for neighbor in neighbors:
            await self.send_to_area(message, neighbor)
    
    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients."""
        disconnected = []
        
        for websocket in self.all_connections:
            try:
                await websocket.send_json(message)
            except Exception:
                disconnected.append(websocket)
        
        for ws in disconnected:
            await self.disconnect(ws)
    
    async def broadcast_pothole(self, pothole_data: dict):
        """Broadcast new pothole to all relevant connections."""
        import h3
        
        # Create standardized message
        message = {
            "type": "new_pothole",
            "data": pothole_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        h3_index = pothole_data.get("h3_index")
        
        # Send to specific area
        if h3_index:
            await self.send_to_area(message, h3_index)
            await self.send_to_neighbors(message, h3_index, ring=1)
        
        # Also broadcast to all for admin dashboard
        await self.broadcast(message)
        
        # Publish to Redis for distributed systems
        if self.redis_client:
            try:
                await self.redis_client.publish(
                    "safaroad:potholes",
                    json.dumps(message)
                )
            except Exception as e:
                print(f"Redis publish failed: {e}")
    
    async def broadcast_alert(
        self, 
        alert_type: str,
        data: dict,
        target_h3_index: Optional[str] = None,
        target_user_id: Optional[str] = None
    ):
        """Broadcast an alert to specific targets."""
        message = {
            "type": alert_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        if target_user_id:
            await self.send_personal_message(message, target_user_id)
        elif target_h3_index:
            await self.send_to_area(message, target_h3_index)
        else:
            await self.broadcast(message)
    
    async def _heartbeat(self):
        """Send periodic heartbeat to maintain connections."""
        while True:
            try:
                await asyncio.sleep(30)  # Every 30 seconds
                
                message = {
                    "type": "heartbeat",
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                disconnected = []
                for websocket in self.all_connections:
                    try:
                        await websocket.send_json(message)
                    except Exception:
                        disconnected.append(websocket)
                
                for ws in disconnected:
                    await self.disconnect(ws)
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Heartbeat error: {e}")
    
    async def _redis_listener(self):
        """Listen for Redis pub/sub messages."""
        if not self.pubsub:
            return
        
        try:
            async for message in self.pubsub.listen():
                if message["type"] == "message":
                    data = json.loads(message["data"])
                    await self.broadcast(data)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"Redis listener error: {e}")
    
    def get_stats(self) -> dict:
        """Get connection statistics."""
        return {
            "total_connections": len(self.all_connections),
            "area_connections": {
                h3: len(conns) 
                for h3, conns in self.area_connections.items()
            },
            "user_connections": len(self.user_connections)
        }


# Global connection manager instance
manager = ConnectionManager()
