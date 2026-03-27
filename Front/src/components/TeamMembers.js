// src/components/TeamMembers.js
import React, { useEffect, useState } from 'react';
import { api } from '../api/client'; // ✅ 하드코딩된 axios 대신 우리가 만든 api 사용!
import './TeamMembers.css';

const TeamMembers = () => {
  const [teamMembers, setTeamMembers] = useState([]);

  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        // ✅ api 인스턴스를 쓰면 토큰이 자동으로 헤더에 담겨 전송됩니다.
        const response = await api.get('/api/team-members');
        setTeamMembers(response.data);
      } catch (error) {
        console.error('Failed to fetch team members:', error);
      }
    };

    fetchTeamMembers();
  }, []);

  return (
    <div className="team-member-list">
      <h4 className="title">팀원목록</h4>
      <ul>
        {teamMembers.length === 0 ? (
          <li className="team-member has-text-grey" style={{ fontSize: 13 }}>
            팀원을 불러오는 중...
          </li>
        ) : (
          teamMembers.map((member, index) => (
            // ✅ 안티 패턴(index만 사용) 방지: 이름과 index를 섞어서 고유 key 생성
            <li key={`${member.name}-${index}`} className="team-member">
              {member.name}
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export default TeamMembers;