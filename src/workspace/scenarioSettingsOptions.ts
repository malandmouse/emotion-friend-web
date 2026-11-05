export const understanding: Record<string, { label: string; values: Record<string, string> }> = {
  informationAmount: { label: '편하게 이해하는 이야기의 정보량', values: { ONE_EVENT: '한 번에 한 사건', SEQUENTIAL_EVENTS: '순서대로 이어지는 여러 사건', BACKGROUND_AND_REASONS: '배경과 이유가 포함된 이야기', VARIABLE: '상황에 따라 달라요' } },
  causeExplanation: { label: '원인 설명이 편한 방식', values: { EXPLICIT_LINK: '왜 그런지 직접 연결해서 설명', EVENT_REMINDER: '관련 사건을 짧게 다시 알려 주기', CONTEXT_INFERENCE: '문맥에서 이유 짐작하기', VARIABLE: '상황에 따라 달라요' } },
  personReference: { label: '사람을 가리키는 표현', values: { NAMES_EXPLICIT: '이름을 분명하게 말하기', PRONOUN_AFTER_NAME: '이름을 말한 뒤 그 친구·걔 사용', MULTIPLE_REFERENTS: '여러 사람을 가리키는 말도 이해', VARIABLE: '상황에 따라 달라요' } },
}
