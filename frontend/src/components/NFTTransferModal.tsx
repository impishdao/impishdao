import { BigNumber, Contract, ethers } from "ethers";
import { useEffect, useState } from "react";
import { Alert, Button, Form, Modal } from "react-bootstrap";

type TransferAddressModalProps = {
  show: boolean;
  nft?: Contract;
  tokenId: BigNumber;
  close: () => void;
  selectedAddress?: string;
};

export const TransferAddressModal = ({ show, tokenId, nft, selectedAddress, close }: TransferAddressModalProps) => {
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // Clear error when showing
  useEffect(() => {
    setError("");
    setInfo("");
    setAddress("");
  }, [show]);

  const doTransfer = async () => {
    if (nft && selectedAddress) {
      try {
        const validAddress = ethers.utils.getAddress(address);
        console.log(`Transfering to ${validAddress}`);

        const tx = await nft["safeTransferFrom(address,address,uint256)"](selectedAddress, validAddress, tokenId);
        setInfo("Transfering....");
        await tx.wait();

        close();
      } catch (e: any) {
        console.log(e);
        setError(e.reason);
      }
    }
  };

  return (
    <Modal show={show} onHide={close}>
      <Modal.Header closeButton>
        <Modal.Title>Transfer #{tokenId.toString()}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        Please enter the ETH address to transfer the NFT to.
        <Form.Group className="mb-3">
          <Form.Control
            placeholder="ETH Address"
            value={address}
            onChange={(e) => {
              setAddress(e.currentTarget.value);
              setError("");
            }}
          />
        </Form.Group>
        {error && <Alert variant="danger">{error}</Alert>}
        {info && <Alert variant="info">{info}</Alert>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" onClick={() => close()}>
          Cancel
        </Button>
        <Button variant="warning" onClick={() => doTransfer()}>
          Transfer
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
