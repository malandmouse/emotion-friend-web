import { useCallback, useState } from 'react'
import { ApiFailure, isObject } from '../api/client'
import { Alert, Card, PageHeader } from '../components/ui'
import { ActionForm } from './ActionForm'
import { childPath } from './api'

export function DevicePage({id}:{id:string}) {
  const [device,setDevice]=useState('unity-foundation-local'),[code,setCode]=useState(''),[expires,setExpires]=useState(''),[busy,setBusy]=useState(false)
  const handleLockChange=useCallback((locked:boolean)=>{
    setBusy(locked)
    if(locked){setCode('');setExpires('')}
  },[])
  return <><PageHeader title="Unity 앱 연결" description="아동 앱의 기기 이름을 확인하고 일회용 코드를 발급합니다." /><Card>
    <div className="stack"><Alert>아동 앱에 보호자 비밀번호나 서버 API 키를 입력하지 않습니다. 이 코드는 해당 아동과 기기에만 사용하며 화면을 벗어나면 사라집니다.</Alert>
    <p className="muted">연결 코드를 받으려면 보호자 웹에 로그인할 때 사용한 비밀번호를 아래에 입력해 주세요.</p>
    {/* 기존 공통 폼이 비밀번호 재확인 → 코드 발급 순서로 실행하고,
        비밀번호 입력을 지웁니다. 서버의 최근 본인 확인 조건은 유지합니다. */}
    <ActionForm label="일회용 연결 코드 받기" reauthenticate onLockChange={handleLockChange}
      prepare={values=>({path:`${childPath(id)}/device-grants`,method:'POST',body:{schemaVersion:'0.3.0',deviceId:String(values.get('deviceId'))},expectedStatus:[200,201]})}
      onSuccess={raw=>{
        if(!isObject(raw)||raw.childId!==id||raw.deviceId!==device||typeof raw.oneTimeCode!=='string'||typeof raw.expiresAt!=='string')throw new ApiFailure('INVALID_RESPONSE')
        setCode(raw.oneTimeCode);setExpires(raw.expiresAt)
      }} onFailure={()=>{setCode('');setExpires('')}}>
      <label>Unity 기기 이름 <input name="deviceId" value={device} required pattern="[A-Za-z0-9][A-Za-z0-9._:\-]{0,127}" maxLength={128} disabled={busy} onChange={e=>{setDevice(e.target.value);setCode('');setExpires('')}} /></label>
    </ActionForm>
    {code && <div role="status"><p>연결 코드: <strong>{code}</strong></p><p>만료 시각: {new Date(expires).toLocaleString('ko-KR')}</p></div>}
    </div></Card></>
}
