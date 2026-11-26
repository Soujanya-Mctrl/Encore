-- Create Encore PGMQ queues (prioritize provenance, settlement, opportunities for MVP)
select pgmq.create('provenance');
select pgmq.create('settlement');
select pgmq.create('licensing');
select pgmq.create('opportunities');
select pgmq.create('notifications');
select pgmq.create('dead_letter');
