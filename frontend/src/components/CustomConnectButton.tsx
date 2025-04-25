import { ConnectButton } from '@rainbow-me/rainbowkit';
import styled from 'styled-components';

const CenteredDiv = styled.div`
  .iekbcc0.ju367va.ju367v1s {
    display: flex;
    justify-content: center;
    width: 100%;
  }
`;

export function CustomConnectButton() {
  return (
    <CenteredDiv>
      <ConnectButton />
    </CenteredDiv>
  );
} 