import { useEffect, useState } from "react";
import { ListGroup, Modal, Button } from "react-bootstrap";
import { MultiTxItem } from "./walletutils";

export type MultiTxModalProps = {
  show: boolean;
  onCancel: () => void;
  onFinish: () => void;
  txns: MultiTxItem[];
  waitForTxConfirmation: (tx: Promise<any>, title?: string) => Promise<boolean>;
};

export function MultiTxModal({ show, txns, waitForTxConfirmation, onCancel, onFinish }: MultiTxModalProps) {
  const [atTxNum, setAtTxNum] = useState(0);

  useEffect(() => {
    (async () => {
      // Start executing the transactions
      if (show === true) {
        for (let i = 0; i < txns.length; i++) {
          setAtTxNum(i);
          const txToExecute = txns[i].tx();
          const success = await waitForTxConfirmation(txToExecute, txns[i].title);
          if (!success) {
            onCancel();
            break;
          }
        }

        onFinish();
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  return (
    <Modal show={show} onHide={onCancel}>
      <Modal.Header closeButton>
        <Modal.Title>Executing Transactions...</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <ListGroup variant="flush">
          {txns.map((tx, i) => (
            <ListGroup.Item key={tx.title}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>{tx.title}</div>
                <div>{i < atTxNum ? "Done" : i === atTxNum ? "Waiting..." : "Pending..."}</div>
              </div>
            </ListGroup.Item>
          ))}
        </ListGroup>
        <Modal.Footer>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal.Body>
    </Modal>
  );
}
