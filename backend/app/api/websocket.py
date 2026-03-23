from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Optional
import json

from ..api.websocket_manager import manager
from .auth import verify_token

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/potholes")
async def websocket_potholes(
    websocket: WebSocket,
    lat: float = Query(None),
    lng: float = Query(None),
    radius: float = Query(5),
    token: str = Query(None)
):
    """
    WebSocket endpoint for real-time pothole updates.
    
    Subscribe to updates in a geographic area.
    """
    from ..services.geospatial import GeospatialService
    
    user_id = None
    if token:
        token_data = verify_token(token)
        if token_data:
            user_id = str(token_data.user_id)
    
    # Calculate H3 index for subscription
    h3_index = None
    if lat is not None and lng is not None:
        h3_index = GeospatialService.lat_lng_to_h3(lat, lng)
    
    await manager.connect(websocket, h3_index=h3_index, user_id=user_id)
    
    # Send welcome message
    await websocket.send_json({
        "type": "connected",
        "h3_index": h3_index,
        "radius_km": radius,
        "timestamp": str(websocket.client)
    })
    
    try:
        while True:
            # Receive and handle messages
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                msg_type = message.get("type")
                
                if msg_type == "subscribe":
                    # Subscribe to different area
                    new_lat = message.get("lat")
                    new_lng = message.get("lng")
                    if new_lat and new_lng:
                        new_h3 = GeospatialService.lat_lng_to_h3(new_lat, new_lng)
                        
                        # Update subscription
                        if h3_index:
                            manager.area_connections[h3_index].discard(websocket)
                        
                        if new_h3 not in manager.area_connections:
                            manager.area_connections[new_h3] = set()
                        manager.area_connections[new_h3].add(websocket)
                        h3_index = new_h3
                        
                        await websocket.send_json({
                            "type": "subscribed",
                            "h3_index": h3_index
                        })
                
                elif msg_type == "ping":
                    await websocket.send_json({"type": "pong"})
                
                elif msg_type == "unsubscribe":
                    if h3_index:
                        manager.area_connections[h3_index].discard(websocket)
                        h3_index = None
                    await websocket.send_json({"type": "unsubscribed"})
                    
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid JSON"
                })
                
    except WebSocketDisconnect:
        await manager.disconnect(websocket)


@router.websocket("/ws/alerts/{user_id}")
async def websocket_alerts(
    websocket: WebSocket,
    user_id: str,
    token: str = Query(None)
):
    """
    WebSocket endpoint for user-specific alerts.
    
    Subscribe to personal notifications.
    """
    # Verify token matches user_id
    if token:
        token_data = verify_token(token)
        if token_data and str(token_data.user_id) != user_id:
            await websocket.close(code=4001)
            return
    
    await manager.connect(websocket, user_id=user_id)
    
    # Send confirmation
    await websocket.send_json({
        "type": "connected",
        "user_id": user_id,
        "subscriptions": ["alerts", "nearby_potholes"]
    })
    
    try:
        while True:
            data = await websocket.receive_text()
            
            if data == "ping":
                await websocket.send_json({"type": "pong"})
                
    except WebSocketDisconnect:
        await manager.disconnect(websocket)


@router.websocket("/ws/admin")
async def websocket_admin(
    websocket: WebSocket,
    token: str = Query(None)
):
    """
    WebSocket endpoint for admin dashboard.
    
    Receives all pothole updates and system events.
    """
    from ..models import Profile
    
    if not token:
        await websocket.close(code=4001)
        return
    
    token_data = verify_token(token)
    if not token_data or token_data.role not in ["admin", "insurance"]:
        await websocket.close(code=4003)
        return
    
    await manager.connect(websocket, user_id=str(token_data.user_id))
    
    # Send connection confirmation
    stats = manager.get_stats()
    await websocket.send_json({
        "type": "admin_connected",
        "role": token_data.role,
        "stats": stats
    })
    
    try:
        while True:
            data = await websocket.receive_text()
            
            if data == "ping":
                await websocket.send_json({
                    "type": "pong",
                    "stats": manager.get_stats()
                })
                
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
