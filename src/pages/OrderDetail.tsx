import { useParams } from "react-router-dom";

const OrderDetail = () => {
  const { id } = useParams();

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-4xl font-bold text-foreground">Order Details</h1>
      <p className="text-muted-foreground mt-2">Order ID: {id}</p>
    </div>
  );
};

export default OrderDetail;
