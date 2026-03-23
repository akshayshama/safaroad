import base64
import httpx
from io import BytesIO
from typing import Optional, Tuple
from PIL import Image
from ..config import settings


class ImageService:
    """Service for handling image uploads and processing."""
    
    IMGBB_URL = "https://api.imgbb.com/1/upload"
    
    @classmethod
    async def upload_to_imgbb(
        cls,
        image_base64: str,
        name: Optional[str] = None
    ) -> Optional[str]:
        """Upload image to ImgBB and return URL."""
        api_key = settings.IMGBB_API_KEY or settings.config.get("IMGBB_API_KEY")
        
        if not api_key:
            # Return placeholder for development
            return f"https://picsum.photos/seed/{hash(image_base64) % 10000}/400/300"
        
        payload = {
            "key": api_key,
            "image": image_base64,
            "name": name or f"safaroad_{hash(image_base64)}"
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    cls.IMGBB_URL,
                    data=payload,
                    timeout=30
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("success"):
                        return data["data"]["url"]
            except Exception as e:
                print(f"Image upload failed: {e}")
        
        return None
    
    @classmethod
    def validate_base64_image(cls, image_base64: str) -> Tuple[bool, str]:
        """Validate and preprocess base64 image."""
        try:
            # Remove data URL prefix if present
            if "base64," in image_base64:
                image_base64 = image_base64.split("base64,")[1]
            
            # Decode and validate
            image_data = base64.b64decode(image_base64)
            image = Image.open(BytesIO(image_data))
            
            # Check format
            if image.format not in ["JPEG", "PNG", "JPG"]:
                return False, "Only JPEG and PNG images are supported"
            
            # Check size (max 5MB)
            if len(image_data) > 5 * 1024 * 1024:
                return False, "Image size must be less than 5MB"
            
            # Check dimensions
            width, height = image.size
            if width < 100 or height < 100:
                return False, "Image must be at least 100x100 pixels"
            
            # Resize if too large (max 1920px on longest side)
            max_dimension = 1920
            if max(width, height) > max_dimension:
                ratio = max_dimension / max(width, height)
                new_size = (int(width * ratio), int(height * ratio))
                image = image.resize(new_size, Image.Resampling.LANCZOS)
                
                # Re-encode
                buffer = BytesIO()
                image.save(buffer, format="JPEG", quality=85)
                image_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            return True, image_base64
            
        except Exception as e:
            return False, f"Invalid image: {str(e)}"
    
    @classmethod
    def extract_location_from_exif(cls, image_base64: str) -> Optional[Tuple[float, float]]:
        """Extract GPS location from EXIF data if available."""
        try:
            from PIL import ExifTags
            
            if "base64," in image_base64:
                image_base64 = image_base64.split("base64,")[1]
            
            image_data = base64.b64decode(image_base64)
            image = Image.open(BytesIO(image_data))
            
            exif = image._getexif()
            if not exif:
                return None
            
            # GPS Info tag
            gps_ifd = None
            for tag_id, tag in ExifTags.TAGS.items():
                if tag == "GPSInfo":
                    gps_ifd = exif.get(tag_id)
                    break
            
            if not gps_ifd:
                return None
            
            # Extract latitude
            lat = None
            lng = None
            
            def convert_to_degrees(value):
                d, m, s = value
                return d + (m / 60.0) + (s / 3600.0)
            
            # Latitude
            if 1 in gps_ifd and 2 in gps_ifd:
                lat = convert_to_degrees(gps_ifd[2])
                if gps_ifd[1] == "S":
                    lat = -lat
            
            # Longitude
            if 3 in gps_ifd and 4 in gps_ifd:
                lng = convert_to_degrees(gps_ifd[4])
                if gps_ifd[3] == "W":
                    lng = -lng
            
            if lat and lng:
                return (lat, lng)
                
        except Exception:
            pass
        
        return None
