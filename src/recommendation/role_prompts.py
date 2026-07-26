"""三角色 AI 推薦提示語定義。

同一分類只呼叫 LLM 一次，但請求內包含消費者、農民與商家三套獨立提示語，
並要求一次回傳三份角色化建議。
"""
from __future__ import annotations

from dataclasses import dataclass


PROMPT_SET_VERSION = "three-role-v1"


@dataclass(frozen=True)
class RolePromptDefinition:
    key: str
    label: str
    perspective: str
    objective: str
    decision_focus: tuple[str, ...]
    cautions: tuple[str, ...]

    def as_prompt_dict(self) -> dict:
        return {
            "role": self.key,
            "label": self.label,
            "perspective": self.perspective,
            "objective": self.objective,
            "decision_focus": list(self.decision_focus),
            "cautions": list(self.cautions),
        }


ROLE_PROMPT_DEFINITIONS: tuple[RolePromptDefinition, ...] = (
    RolePromptDefinition(
        key="consumer",
        label="消費者",
        perspective="家庭採買端",
        objective="協助一般家庭判斷現在適合買什麼、買多少，以及偏貴時可比較哪些替代品。",
        decision_focus=(
            "家庭預算與採買時機",
            "便宜、正常、偏貴品項的白話行動",
            "偏貴品項的同分類替代選擇",
            "避免囤貨與過度採買",
        ),
        cautions=(
            "不得假設家庭人口、冰箱容量、飲食需求或健康狀況。",
            "不得提供醫療、營養療效或食安保證。",
        ),
    ),
    RolePromptDefinition(
        key="farmer",
        label="農民",
        perspective="農業生產端",
        objective="協助生產者從目前市場行情判斷採收、分批出貨與行情觀察的優先順序。",
        decision_focus=(
            "採收與出貨節奏",
            "行情偏高時的供應機會",
            "行情偏低時的成本與風險確認",
            "避免以單日行情擴大生產或做保證性預測",
        ),
        cautions=(
            "不得虛構產量、產地、天氣、成本、保存條件或通路合約。",
            "不得直接指示擴種、停種或延後採收；只能提出需核對的決策方向。",
        ),
    ),
    RolePromptDefinition(
        key="merchant",
        label="商家",
        perspective="通路銷售端",
        objective="協助零售或餐飲採購端安排分批補貨、庫存風險與促銷搭配方向。",
        decision_focus=(
            "進貨成本與分批補貨",
            "偏貴品項的庫存控制與替代品",
            "價格正常品項的銷售速度核對",
            "避免把行情資料誤當成需求或庫存資料",
        ),
        cautions=(
            "不得虛構門市庫存、銷量、毛利、客群或需求。",
            "不得提供保證獲利、固定售價或操縱市場建議。",
        ),
    ),
)

ROLE_KEYS = tuple(item.key for item in ROLE_PROMPT_DEFINITIONS)
_ROLE_BY_KEY = {item.key: item for item in ROLE_PROMPT_DEFINITIONS}


def get_role_prompt(role_key: str) -> RolePromptDefinition:
    try:
        return _ROLE_BY_KEY[role_key]
    except KeyError as exc:
        raise ValueError(f"不支援的推薦角色: {role_key}") from exc
