alter table loads
  add constraint loads_shipment_id_fkey
  foreign key (shipment_id) references shipments(id);
