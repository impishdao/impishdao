import { ethers, BigNumber } from "ethers";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Alert, Button, Col, Container, FormControl, InputGroup, Row, Tab, Table, Tabs } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";
import { CrystalInfo, DappContracts, DappFunctions, DappState } from "../AppState";
import { setup_crystal } from "../crystalRenderer";
import { Navigation } from "./Navigation";
import { formatkmb, retryTillSucceed } from "./utils";

type CrystalDetailProps = DappState & DappFunctions & DappContracts & {};

export function CrystalDetail(props: CrystalDetailProps) {
  const { id } = useParams();
  const canvasDetailRef = useRef<HTMLCanvasElement>(null);

  const [crystalInfo, setCrystalInfo] = useState<CrystalInfo | undefined>();
  const [approvalNeeded, setApprovalNeeded] = useState(true);

  const [growBy, setGrowBy] = useState("1");
  const [addSym, setAddSym] = useState("1");
  const [reduceSym, setReduceSym] = useState("1");

  const [previewSize, setPreviewSize] = useState<number | undefined>();
  const [previewSym, setPreviewSym] = useState<number | undefined>();

  useEffect(() => {
    if (canvasDetailRef.current) {
      if (crystalInfo) {
        let size = previewSize || crystalInfo.size;
        let sym = previewSym || crystalInfo.sym;

        setup_crystal(canvasDetailRef.current, crystalInfo.seed.toHexString(), sym, crystalInfo.generation, size / 100);
      } else {
        const ctx = canvasDetailRef.current.getContext("2d");

        ctx?.resetTransform();
        ctx?.clearRect(0, 0, canvasDetailRef.current.width, canvasDetailRef.current.height);
      }
    }
  }, [crystalInfo, previewSize, previewSym]);

  // Check for approval for Spending by Crystals
  useEffect(() => {
    retryTillSucceed(async () => {
      if (props.selectedAddress && props.crystal && props.spiralbits) {
        const currentAllowance = await props.spiralbits?.allowance(props.selectedAddress, props.crystal?.address);

        setApprovalNeeded(currentAllowance.eq(0));
      }
    });
  }, [props.crystal, props.selectedAddress, props.spiralbits]);

  useLayoutEffect(() => {
    fetch(`/crystalapi/crystal/metadata/${id}`)
      .then((d) => d.json())
      .then((j) => {
        const attributes = j.attributes;
        setCrystalInfo({
          ...attributes,
          seed: BigNumber.from(attributes.seed),
          spiralBitsStored: BigNumber.from(attributes.spiralBitsStored),
        });
      });

    setPreviewSym(undefined);
    setPreviewSize(undefined);
  }, [id]);

  const validateGrowBy = (s: string) => {
    if (isNaN(parseInt(s))) {
      return;
    }

    const n = parseInt(s);

    if (n < 0) {
      return;
    }

    // Max size
    if (crystalInfo && n + crystalInfo.size > 100) {
      return;
    }

    if (n && crystalInfo) {
      setPreviewSize(n + crystalInfo.size);
    } else {
      setPreviewSize(undefined);
    }
    setGrowBy(n.toString());
  };

  const setMaxGrowBy = () => {
    // Max grow by is 1k per size per sym
    let maxGrowBy = 0;
    if (props.spiralBitsBalance && crystalInfo) {
      const availableSize = Math.floor(
        props.spiralBitsBalance.div(ethers.utils.parseEther("1000")).div(crystalInfo.sym).toNumber()
      );
      maxGrowBy = availableSize + crystalInfo.size > 100 ? 100 - crystalInfo.size : availableSize;
    }

    validateGrowBy(maxGrowBy.toString());
  };

  const setMaxAddSyn = () => {
    let maxAddSym = 0;
    if (props.spiralBitsBalance && crystalInfo) {
      const availableSym = Math.floor(props.spiralBitsBalance.div(ethers.utils.parseEther("20000")).toNumber());
      maxAddSym = availableSym + crystalInfo.sym > 20 ? 20 - crystalInfo.sym : availableSym;
    }

    validateAddSym(maxAddSym.toString());
  };

  const setMaxReduceSym = () => {
    let maxReduceSym = 0;
    if (props.spiralBitsBalance && crystalInfo) {
      const availableSym = Math.floor(props.spiralBitsBalance.div(ethers.utils.parseEther("20000")).toNumber());
      maxReduceSym = crystalInfo.sym - availableSym < 3 ? crystalInfo.sym - 3 : availableSym;
    }

    validateReduceSym(maxReduceSym.toString());
  };

  const validateAddSym = (s: string) => {
    if (isNaN(parseInt(s))) {
      return;
    }

    const n = parseInt(s);

    if (n < 0) {
      return;
    }

    // Max size
    if (crystalInfo && n + crystalInfo.sym > 20) {
      return;
    }

    if (n && crystalInfo) {
      // Remember that adding a sym also reduces the length
      const newSize = (crystalInfo.size * crystalInfo.sym) / (crystalInfo.sym + n);
      if (newSize < 30) {
        return;
      }

      setPreviewSize(newSize);
      setPreviewSym(n + crystalInfo.sym);
    } else {
      setPreviewSym(undefined);
    }
    setAddSym(n.toString());
  };

  const validateReduceSym = (s: string) => {
    if (isNaN(parseInt(s))) {
      return;
    }

    const n = parseInt(s);

    if (n < 0) {
      return;
    }

    // Max size
    if (crystalInfo && crystalInfo.sym - n < 3) {
      return;
    }

    if (n && crystalInfo) {
      setPreviewSym(crystalInfo.sym - n);
    } else {
      setPreviewSym(undefined);
    }
    setReduceSym(n.toString());
  };

  const spiralBitsNeededToGrow = (): BigNumber => {
    if (crystalInfo) {
      return ethers.utils.parseEther("1000").mul(crystalInfo.sym * parseInt(growBy));
    }

    return BigNumber.from(0);
  };

  const spiralBitsNeededToAddSym = (): BigNumber => {
    if (crystalInfo) {
      return ethers.utils.parseEther("20000").mul(addSym);
    }

    return BigNumber.from(0);
  };

  const spiralBitsNeededToReduceSym = (): BigNumber => {
    if (crystalInfo) {
      return ethers.utils.parseEther("20000").mul(reduceSym);
    }

    return BigNumber.from(0);
  };

  const resetManageVars = () => {
    setGrowBy("0");
    setAddSym("0");
    setReduceSym("0");
    setPreviewSize(undefined);
    setPreviewSym(undefined);
  };

  const approveSpiralBits = async (): Promise<boolean> => {
    if (!approvalNeeded) {
      return true;
    }

    if (props.spiralbits && props.crystal) {
      const success = await props.waitForTxConfirmation(
        props.spiralbits.approve(props.crystal.address, ethers.utils.parseEther("2000000000")),
        "Approving SPIRALBITS"
      );

      if (success) {
        setApprovalNeeded(false);
        return true;
      }
    }
    return false;
  };

  const growCrystal = async () => {
    if (props.selectedAddress && props.crystal && props.spiralbits && crystalInfo) {
      // Check for approval needed first
      if (await approveSpiralBits()) {
        const success = await props.waitForTxConfirmation(props.crystal.grow(id, parseInt(growBy)), "Growing Crystal");

        if (success) {
          const newSize = crystalInfo.size + parseInt(growBy);
          const newSpiralBitsStored = crystalInfo.spiralBitsStored.add(spiralBitsNeededToGrow().div(2));
          setCrystalInfo({ ...crystalInfo, size: newSize, spiralBitsStored: newSpiralBitsStored });
          resetManageVars();
          props.readUserData();
        }
      }
    }
  };

  const doAddSym = async () => {
    if (props.selectedAddress && props.crystal && props.spiralbits && crystalInfo) {
      // Check for approval needed first
      if (await approveSpiralBits()) {
        const success = await props.waitForTxConfirmation(
          props.crystal.addSym(id, parseInt(addSym)),
          "Adding Symmetry to Crystal"
        );

        if (success) {
          const newSym = crystalInfo.sym + parseInt(addSym);
          const newSize = (crystalInfo.size * crystalInfo.sym) / newSym;
          setCrystalInfo({ ...crystalInfo, size: Math.floor(newSize), sym: newSym });
          resetManageVars();
          props.readUserData();
        }
      }
    }
  };

  const doReduceSym = async () => {
    if (props.selectedAddress && props.crystal && props.spiralbits && crystalInfo) {
      // Check for approval needed first
      if (await approveSpiralBits()) {
        const success = await props.waitForTxConfirmation(
          props.crystal.decSym(id, parseInt(reduceSym)),
          "Reduce Symmetry of Crystal"
        );

        if (success) {
          const newSize = crystalInfo.sym - parseInt(reduceSym);
          setCrystalInfo({ ...crystalInfo, sym: newSize });
          resetManageVars();
          props.readUserData();
        }
      }
    }
  };

  const shatter = async () => {
    if (props.selectedAddress && props.crystal) {
      const success = await props.waitForTxConfirmation(props.crystal.shatter(id), "Shatter Crystal");

      if (success) {
        resetManageVars();
        setCrystalInfo(undefined);
        props.readUserData();
      }
    }
  };

  console.log(`${props.selectedAddress} - ${crystalInfo?.owner}`);

  return (
    <>
      <Navigation {...props} />
      <div style={{ textAlign: "center", marginTop: "-50px", paddingTop: "100px" }}>
        <h1>Crystal #{id}</h1>
        <Container>
          <Row>
            <Col xs={5} style={{ textAlign: "left" }}>
              <h5 className="mt-3" style={{ color: "#ffd454" }}>
                Owner
              </h5>
              <div>
                {crystalInfo && (
                  <Link to={`/wallet/${crystalInfo.owner}/crystals`} style={{ color: "white", textDecoration: "none" }}>
                    {crystalInfo?.owner}
                  </Link>
                )}
              </div>

              <div style={{ minHeight: "250px" }}>
                <h5 className="mt-5" style={{ color: "#ffd454" }}>
                  Manage Crystal
                </h5>
                {!props.selectedAddress && (
                  <>
                    <div className="mb-3">Connect your wallet to manage this crystal</div>
                    <Button className="connect" variant="warning" onClick={props.connectWallet}>
                      Connect Wallet
                    </Button>
                  </>
                )}

                {props.selectedAddress && props.selectedAddress.toLowerCase() === crystalInfo?.owner.toLowerCase() && (
                  <>
                    <Tabs className="mt-3">
                      <Tab eventKey="Grow" title="Grow" tabClassName="colorwhite">
                        <div style={{ fontSize: "0.9rem", marginTop: "10px" }}>
                          Grow your crystal by feeding it SPIRALBITS. Half of the SPIRALBITS are stored inside the
                          Crystal (and the other half are burned)
                        </div>

                        <div style={{ display: "flex", gap: "30px", marginTop: "10px" }}>
                          <InputGroup>
                            <InputGroup.Text>Grow Size By</InputGroup.Text>
                            <FormControl
                              type="number"
                              style={{ textAlign: "right" }}
                              value={growBy}
                              onChange={(e) => validateGrowBy(e.currentTarget.value)}
                            />
                            <Button onClick={setMaxGrowBy}>Max</Button>
                          </InputGroup>
                          <Button variant="warning" onClick={growCrystal}>
                            {approvalNeeded && "Approve & "} Grow
                          </Button>
                        </div>

                        <div style={{ marginTop: "10px" }}>Cost: {formatkmb(spiralBitsNeededToGrow())} SPIRALBITS</div>
                        {spiralBitsNeededToGrow().gt(props.spiralBitsBalance) && (
                          <Alert className="mt-3" variant="danger">
                            Not Enough SPIRALBITS
                          </Alert>
                        )}
                      </Tab>
                      <Tab eventKey="Add" title="Add Symmetry" tabClassName="colorwhite">
                        <div style={{ fontSize: "0.9rem", marginTop: "10px" }}>
                          Adding a symmetry increases the complexity of the Crystal, but will need more SPIRALBITS to
                          grow. Your Crystal will also shrink proportionally
                        </div>

                        <div style={{ display: "flex", gap: "30px", marginTop: "10px" }}>
                          <InputGroup>
                            <InputGroup.Text>Add Symmetries</InputGroup.Text>
                            <FormControl
                              type="number"
                              style={{ textAlign: "right" }}
                              value={addSym}
                              size={"sm"}
                              onChange={(e) => validateAddSym(e.currentTarget.value)}
                            />
                            <Button onClick={setMaxAddSyn}>Max</Button>
                          </InputGroup>
                          <Button variant="warning" onClick={doAddSym}>
                            {approvalNeeded && "Approve & "} Add
                          </Button>
                        </div>

                        <div style={{ marginTop: "10px" }}>
                          Cost: {formatkmb(spiralBitsNeededToAddSym())} SPIRALBITS
                        </div>
                        {spiralBitsNeededToAddSym().gt(props.spiralBitsBalance) && (
                          <Alert className="mt-3" variant="danger">
                            Not Enough SPIRALBITS
                          </Alert>
                        )}
                      </Tab>
                      <Tab eventKey="Reduce" title="Reduce Symmetry" tabClassName="colorwhite">
                        <div style={{ fontSize: "0.9rem", marginTop: "10px" }}>
                          Reducing symmetry decreases the complexity of the Crystal and needs fewer SPIRALBITS to grow.
                        </div>

                        <div style={{ display: "flex", gap: "30px", marginTop: "10px" }}>
                          <InputGroup>
                            <InputGroup.Text>Reduce Symmetries</InputGroup.Text>
                            <FormControl
                              type="number"
                              style={{ textAlign: "right" }}
                              value={reduceSym}
                              onChange={(e) => validateReduceSym(e.currentTarget.value)}
                            />
                            <Button onClick={setMaxReduceSym}>Max</Button>
                          </InputGroup>
                          <Button variant="warning" onClick={doReduceSym}>
                            {approvalNeeded && "Approve & "} Reduce
                          </Button>
                        </div>

                        <div style={{ marginTop: "10px" }}>
                          Cost: {formatkmb(spiralBitsNeededToReduceSym())} SPIRALBITS
                        </div>
                        {spiralBitsNeededToReduceSym().gt(props.spiralBitsBalance) && (
                          <Alert className="mt-3" variant="danger">
                            Not Enough SPIRALBITS
                          </Alert>
                        )}
                      </Tab>
                      <Tab eventKey="Shatter" title="Shatter" tabClassName="colorwhite">
                        <div style={{ fontSize: "0.9rem", marginTop: "10px" }}>
                          Shattering a crystal irreversibly burns it, but recovers the stored SPIRALBITS in it.
                        </div>
                        <Button className="mt-3" variant="warning" onClick={shatter}>
                          Shatter
                        </Button>
                        <div className="mt-3" style={{ marginTop: "10px" }}>
                          You will receive: {formatkmb(crystalInfo?.spiralBitsStored)} SPIRALBITS
                        </div>
                      </Tab>
                    </Tabs>
                  </>
                )}
              </div>

              <h5 className="mt-5" style={{ color: "#ffd454" }}>
                Properties
              </h5>
              <Table style={{ color: "white" }}>
                <tbody>
                  <tr>
                    <td>Size</td>
                    <td>{crystalInfo?.size} %</td>
                  </tr>
                  <tr>
                    <td>Symmetries</td>
                    <td>{crystalInfo?.sym}</td>
                  </tr>
                  <tr>
                    <td>Generation</td>
                    <td>Gen{crystalInfo?.generation}</td>
                  </tr>
                  <tr>
                    <td>SPIRALBITS stored</td>
                    <td>{formatkmb(crystalInfo?.spiralBitsStored)}</td>
                  </tr>
                </tbody>
              </Table>
            </Col>
            <Col xs={7}>
              {(previewSize || previewSym) && <div>PREVIEW</div>}
              {!(previewSize || previewSym) && <div>Crystal #{id}</div>}
              <div
                style={{
                  border: `solid ${previewSym || previewSize ? "3px #ffd454" : "1px white"}`,
                  borderRadius: "10px",
                  padding: "10px",
                }}
              >
                <canvas ref={canvasDetailRef} width="500px" height="500px"></canvas>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  gap: "10px",
                  marginTop: "10px",
                  justifyContent: "center",
                }}
              >
                {/* {(props.selectedAddress && crystalInfo?.owner.toLowerCase() === props.selectedAddress?.toLowerCase()) && (
                  <Button variant="dark" onClick={() => setTransferAddressModalShowing(true)}>
                    Transfer
                  </Button>
                )} */}
              </div>
            </Col>

            <div className="mb-4"></div>
          </Row>
        </Container>
      </div>
    </>
  );
}
