"""白名單分類與推薦快取鍵定義。"""
from __future__ import annotations

from dataclasses import dataclass


SCHEMA_VERSION = 2


class UnknownRecommendationCategory(ValueError):
    """Raised when a category is not part of the supported catalog."""


@dataclass(frozen=True)
class CategoryDefinition:
    key: str
    label: str
    description: str
    examples: tuple[str, ...]
    keywords: tuple[str, ...]

    def as_dict(self) -> dict:
        return {
            "key": self.key,
            "label": self.label,
            "description": self.description,
        }

    def matches(self, product_name: str) -> bool:
        return any(keyword in product_name for keyword in self.keywords)


CATEGORY_CATALOG: tuple[CategoryDefinition, ...] = (
    CategoryDefinition(
        key="leafy-vegetables",
        label="葉菜類",
        description="高麗菜、白菜、菠菜等葉菜",
        examples=("高麗菜", "白菜", "菠菜", "空心菜", "青江菜"),
        keywords=("高麗菜", "白菜", "菠菜", "空心菜", "青江菜", "小白菜", "芥藍", "萵苣", "油菜", "芥菜", "A菜"),
    ),
    CategoryDefinition(
        key="fruit-vegetables",
        label="果菜類",
        description="番茄、茄子、瓜類、甜椒與豆類",
        examples=("番茄", "茄子", "絲瓜", "甜椒", "四季豆"),
        keywords=("番茄", "茄子", "絲瓜", "苦瓜", "冬瓜", "南瓜", "胡瓜", "小黃瓜", "甜椒", "青椒", "四季豆", "菜豆", "豇豆", "毛豆", "豆莢"),
    ),
    CategoryDefinition(
        key="root-vegetables",
        label="根莖類",
        description="蘿蔔、馬鈴薯、洋蔥、薑、蒜與筍類",
        examples=("蘿蔔", "馬鈴薯", "洋蔥", "薑", "蒜"),
        keywords=("蘿蔔", "馬鈴薯", "洋蔥", "薑", "蒜", "筍", "芋", "胡蘿蔔", "地瓜"),
    ),
    CategoryDefinition(
        key="fruit",
        label="水果類",
        description="香蕉、鳳梨、芒果、柑橘與瓜果",
        examples=("香蕉", "鳳梨", "芒果", "柑橘", "西瓜"),
        keywords=("香蕉", "鳳梨", "芒果", "柑橘", "柳丁", "橘子", "蘋果", "梨", "葡萄", "木瓜", "西瓜", "哈密瓜", "火龍果", "番石榴", "蓮霧", "柿"),
    ),
    CategoryDefinition(
        key="mushrooms",
        label="菇菌類",
        description="香菇、金針菇、杏鮑菇、木耳等菇菌",
        examples=("香菇", "金針菇", "杏鮑菇", "木耳", "鴻喜菇"),
        keywords=("香菇", "金針菇", "杏鮑菇", "木耳", "鴻喜菇", "蘑菇", "洋菇", "秀珍菇"),
    ),
)

_BY_KEY = {item.key: item for item in CATEGORY_CATALOG}


def get_category(category_key: str) -> CategoryDefinition:
    category = _BY_KEY.get(category_key)
    if category is None:
        raise UnknownRecommendationCategory(category_key)
    return category


def list_categories() -> list[dict]:
    return [category.as_dict() for category in CATEGORY_CATALOG]


def cache_key_for(category_key: str) -> str:
    """Return the validated relative key used by cache repositories."""
    get_category(category_key)
    return f"v{SCHEMA_VERSION}/{category_key}.json"
