---
- name: Bulk inject Open5GS subscribers (safe & idempotent)
  hosts: localhost                  # or your mongo host
  connection: local
  vars:
    mongo_uri: "mongodb://localhost/open5gs"
    plmn: "99970"                   # MCC=999, MNC=70
    key: "465B5CE8B199B49FAA5F0A2EE238A6BC"
    opc: "E8ED289DEBA952E4283B54E88E6183CA"
    start_idx: 1
    end_idx: 100                    # Change this to 1000, 5000, etc.
    apn: "internet"
    ambr_gbps: 1                    # 1 Gbps = 1000000000 bps

  tasks:
    - name: Generate subscriber IMSIs
      set_fact:
        imsi_list: >-
          {{ range(start_idx, end_idx + 1) |
             map('printf', plmn + '%010d') |
             list }}

    - name: Inject or update subscribers (upsert = safe to re-run)
      community.mongodb.mongodb_document:
        connection_options:
          uri: "{{ mongo_uri }}"
        database: open5gs
        collection: subscribers
        filter:
          imsi: "{{ item }}"
        document:
          "$set":
            imsi: "{{ item }}"
            schema_version: 1
            security:
              k: "{{ key }}"
              opc: "{{ opc }}"
              op: null
              amf: "8000"
            slice:
              - sst: 1
                sd: "000000"
                default_indicator: true
                session:
                  - name: "{{ apn }}"
                    type: 3
                    type: 3
                    qos:
                      index: 9
                      arp:
                        priority_level: 8
                        pre_emption_capability: 1
                        pre_emption_vulnerability: 2
                    ambr:
                      downlink:
                        value: {{ ambr_gbps * 1000000000 }}
                        unit: 0
                      uplink:
                        value: {{ ambr_gbps * 1000000000 }}
                        unit: 0
                    pcc_rule: []
            ambr:
              downlink:
                value: {{ ambr_gbps * 1000000000 }}
                unit: 0
              uplink:
                value: {{ ambr_gbps * 1000000000 }}
                unit: 0
            access_restriction_data: 32
            network_access_mode: 0
            subscriber_status: 0
            operator_determined_barring: 0
            subscribed_rau_tau_timer: 12
            msisdn: []
            imeisv: []
            mme_host: []
            mm_realm: []
            purge_flag: []
            __v: 0
        upsert: true
      loop: "{{ imsi_list }}"
      register: inject_result
      changed_when: inject_result.matched == 0 or inject_result.modified > 0

    - name: Summary
      debug:
        msg: |
          Successfully processed {{ imsi_list | length }} subscribers
          IMSI range: {{ plmn }}{{ start_idx | string | ljust(10, '0') }} → {{ plmn }}{{ end_idx | string | ljust(10, '0') }}