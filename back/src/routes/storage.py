from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List, Dict, Any
import os
from enum import Enum

from src.services.storage.supabase import Supabase

def get_storage() -> Supabase:
    """Return a singleton instance of the Supabase storage helper configured
    from environment variables `SUPABASE_URL` and `SUPABASE_KEY`."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY environment variables must be set.")

    # Re-use a single instance to avoid recreating connections on every request
    if not hasattr(get_storage, "_instance"):
        get_storage._instance = Supabase(url, key, openai_key)
    return get_storage._instance


class DataCategory(str, Enum):
    social = "social"
    trivia = "trivia"
    science = "science"
    code = "code"
    trenches = "trenches"
    general = "general"


class KnowledgeCreate(BaseModel):
    url: Optional[HttpUrl] = None
    content: Optional[str] = None
    title: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    category: DataCategory = DataCategory.general
    tags: List[str] = Field(default_factory=list)


class ImageCreate(BaseModel):
    image_url: HttpUrl
    alt_text: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class DataInstanceCreate(BaseModel):
    content: str
    content_type: str = Field(..., examples=["text", "markdown", "json", "url", "file"])
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    category: DataCategory = DataCategory.general
    tags: List[str] = Field(default_factory=list)
    knowledge_list: Optional[List[KnowledgeCreate]] = Field(None, description="List of knowledge objects to attach to this instance")
    image_urls: Optional[List[HttpUrl]] = Field(None, description="List of image URLs to attach to this instance")


class DataInstanceResponse(BaseModel):
    id: str
    pet_id: str
    content: str
    content_type: str
    metadata: Optional[Dict[str, Any]] = None
    category: str
    tags: List[str]
    created_at: str
    knowledge: Optional[List[Dict[str, Any]]]
    images: Optional[List[Dict[str, Any]]]

    class Config:
        orm_mode = True


class PetResponse(BaseModel):
    id: str
    owner_wallet: str
    name: str
    rarity: str
    social: int
    trivia: int
    science: int
    code: int
    trenches: int
    streak: int
    created_at: str

    class Config:
        orm_mode = True


router = APIRouter(prefix="/storage", tags=["Storage"])


@router.get("/users/{wallet_address}/pets", response_model=List[PetResponse])
async def list_user_pets(wallet_address: str, storage: Supabase = Depends(get_storage)):
    """Return all pets belonging to `wallet_address` (ordered by creation date DESC)."""
    try:
        return storage.get_user_pets(wallet_address)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get("/pets/{pet_id}", response_model=PetResponse)
async def get_pet(pet_id: str, storage: Supabase = Depends(get_storage)):
    """Retrieve a single pet by its ID."""
    result = storage.get_pet(pet_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pet not found")
    return result


@router.get("/pets/{pet_id}/export", response_model=Dict[str, Any])
async def export_pet_data(pet_id: str, storage: Supabase = Depends(get_storage)):
    """Export complete pet data including all nested instances, knowledge, and images."""
    result = storage.export_pet_data(pet_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pet not found")
    return result


@router.post("/pets/{pet_id}/instances", response_model=DataInstanceResponse, status_code=status.HTTP_201_CREATED)
async def create_datainstance(pet_id: str, payload: DataInstanceCreate, storage: Supabase = Depends(get_storage)):
    """Create a DataInstance for the specified pet. Optionally attach knowledge items and images in one request."""
    try:
        # Convert knowledge list properly
        knowledge_list = None
        if payload.knowledge_list:
            knowledge_list = []
            for k in payload.knowledge_list:
                knowledge_dict = k.model_dump()
                if knowledge_dict.get('url'):
                    knowledge_dict['url'] = str(knowledge_dict['url'])  # Convert HttpUrl to string
                knowledge_list.append(knowledge_dict)
        
        instance = storage.create_complete_datainstance(
            pet_id=pet_id,
            content=payload.content,
            content_type=payload.content_type,
            knowledge_list=knowledge_list,
            image_urls=[str(url) for url in payload.image_urls] if payload.image_urls else None,
            metadata=payload.metadata,
            category=payload.category.value,
            tags=payload.tags,
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
    return instance


@router.get("/pets/{pet_id}/instances", response_model=List[Dict[str, Any]])
async def list_pet_instances(
    pet_id: str,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    storage: Supabase = Depends(get_storage),
):
    """Return basic information for DataInstances contained in the pet (paginated)."""
    return storage.get_pet_instances(pet_id, limit=limit, offset=offset)


@router.get("/pets/{pet_id}/knowledge", response_model=List[Dict[str, Any]])
async def list_pet_knowledge(
    pet_id: str,
    limit: int = Query(100, ge=1, le=1000),
    storage: Supabase = Depends(get_storage),
):
    """Return all knowledge items associated with a pet's data instances."""
    try:
        return storage.get_pet_knowledge(pet_id, limit=limit)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get("/datainstances/{datainstance_id}", response_model=DataInstanceResponse)
async def get_datainstance(datainstance_id: str, storage: Supabase = Depends(get_storage)):
    """Retrieve a DataInstance along with its related knowledge and images."""
    instance = storage.get_datainstance_with_content(datainstance_id)
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DataInstance not found")
    return instance


@router.get("/datainstances/{datainstance_id}/knowledge", response_model=List[Dict[str, Any]])
async def get_datainstance_knowledge(datainstance_id: str, storage: Supabase = Depends(get_storage)):
    """Retrieve all knowledge associated with a specific DataInstance."""
    try:
        knowledge = storage.get_datainstance_knowledge(datainstance_id)
        return knowledge
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get("/datainstances/{datainstance_id}/images", response_model=List[Dict[str, Any]])
async def get_datainstance_images(datainstance_id: str, storage: Supabase = Depends(get_storage)):
    """Retrieve all images associated with a specific DataInstance."""
    try:
        images = storage.get_datainstance_images(datainstance_id)
        return images
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.post("/datainstances/{datainstance_id}/knowledge", response_model=List[Dict[str, Any]], status_code=status.HTTP_200_OK)
async def add_knowledge(datainstance_id: str, payload: List[KnowledgeCreate], storage: Supabase = Depends(get_storage)):
    """Attach one or more Knowledge documents to an existing DataInstance."""
    # Validate and convert knowledge data
    knowledge_data = []
    for k in payload:
        # Validate that each knowledge item has either URL or content
        if not k.url and (not k.content or k.content.strip() == ""):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Each knowledge item must have either a URL or content"
            )
        
        knowledge_dict = k.model_dump()
        if knowledge_dict.get('url'):
            knowledge_dict['url'] = str(knowledge_dict['url'])  # Convert HttpUrl to string
        knowledge_data.append(knowledge_dict)
    
    try:
        results = storage.bulk_add_knowledge(datainstance_id, knowledge_data)
        return results
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.post("/datainstances/{datainstance_id}/images", response_model=List[Dict[str, Any]], status_code=status.HTTP_200_OK)
async def add_images(datainstance_id: str, payload: List[ImageCreate], storage: Supabase = Depends(get_storage)):
    """Attach one or more Images to an existing DataInstance."""
    urls = [str(img.image_url) for img in payload]
    results = storage.bulk_add_images(datainstance_id, urls)
    return results


@router.get("/pets/{pet_id}/search", response_model=Dict[str, List[Dict[str, Any]]])
async def search_pet_content(
    pet_id: str, 
    q: str = Query(..., description="Search query"), 
    limit: int = Query(20, ge=1, le=100), 
    storage: Supabase = Depends(get_storage)
):
    """Full-text search across a pet's DataInstances and Knowledge documents."""
    return storage.search_pet_content(pet_id=pet_id, search_query=q, limit=limit)


@router.get("/users/{wallet_address}/search", response_model=Dict[str, List[Dict[str, Any]]])
async def search_user_content(
    wallet_address: str, 
    q: str = Query(..., description="Search query"), 
    limit: int = Query(20, ge=1, le=100), 
    storage: Supabase = Depends(get_storage)
):
    """Full-text search across all DataInstances and Knowledge documents for a user's pets."""
    return storage.search_user_content(wallet_address=wallet_address, search_query=q, limit=limit)


@router.get("/users/{wallet_address}/statistics", response_model=Dict[str, Any])
async def user_statistics(wallet_address: str, storage: Supabase = Depends(get_storage)):
    """Aggregate statistics for the specified user (number of pets, instances, etc.)."""
    return storage.get_user_statistics(wallet_address)


@router.get("/semantic/search", response_model=List[Dict[str, Any]])
async def semantic_search_global(
    q: str = Query(..., description="Semantic search query"),
    limit: int = Query(20, ge=1, le=100),
    similarity_threshold: float = Query(0.7, ge=0.0, le=1.0, description="Minimum similarity score (0-1)"),
    storage: Supabase = Depends(get_storage)
):
    """Perform semantic search across all knowledge using OpenAI embeddings."""
    try:
        return storage.semantic_search_knowledge(
            query=q, 
            limit=limit, 
            similarity_threshold=similarity_threshold
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get("/pets/{pet_id}/semantic/search", response_model=List[Dict[str, Any]])
async def semantic_search_pet(
    pet_id: str,
    q: str = Query(..., description="Semantic search query"),
    limit: int = Query(20, ge=1, le=100),
    similarity_threshold: float = Query(0.7, ge=0.0, le=1.0, description="Minimum similarity score (0-1)"),
    storage: Supabase = Depends(get_storage)
):
    """Perform semantic search across a specific pet's knowledge using OpenAI embeddings."""
    try:
        return storage.semantic_search_pet_knowledge(
            pet_id=pet_id,
            query=q, 
            limit=limit, 
            similarity_threshold=similarity_threshold
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get("/users/{wallet_address}/semantic/search", response_model=List[Dict[str, Any]])
async def semantic_search_user(
    wallet_address: str,
    q: str = Query(..., description="Semantic search query"),
    limit: int = Query(20, ge=1, le=100),
    similarity_threshold: float = Query(0.7, ge=0.0, le=1.0, description="Minimum similarity score (0-1)"),
    storage: Supabase = Depends(get_storage)
):
    """Perform semantic search across all knowledge for a user's pets using OpenAI embeddings."""
    try:
        return storage.semantic_search_user_knowledge(
            wallet_address=wallet_address,
            query=q, 
            limit=limit, 
            similarity_threshold=similarity_threshold
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))