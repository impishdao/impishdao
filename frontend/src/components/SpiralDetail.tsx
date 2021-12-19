import { useParams } from "react-router-dom";

export function SpiralDetail() {
    const {id} = useParams();
    return (
        <div>Spiral ID {id}</div>
    );
}