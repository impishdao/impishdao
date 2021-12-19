import { useParams } from "react-router-dom";

export function SpiralWallet() {
  const { address } = useParams();
  return <div>User Wallet {address}</div>;
}
