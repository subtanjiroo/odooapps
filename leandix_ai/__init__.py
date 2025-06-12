import json
import logging
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError
from . import models
from . import controllers

_logger = logging.getLogger(__name__)
# This function will registry API and ID Leandix Account for user

def setup_user_account(env):
    _logger.info("=== Running setup_user_account ===")

    # URL của API tạo key (cập nhật nếu khác)
    url = "https://platform1.leandix.com/api/api_key_management/public/create"

    try:
        headers = {
            "User-Agent": "Mozilla/5.0",
            "Accept": "*/*",
            "Connection": "keep-alive",
            "Cache-Control": "no-cache"
        }
        request = Request(url, headers=headers, method='GET')
        with urlopen(request) as response:
            if response.status == 200:
                _logger.info(" - response = %s", response)
                raw_data = response.read().decode("utf-8")
                _logger.info(" - raw_data = %s", raw_data)
                data = json.loads(raw_data)
                _logger.info(" - data  = %s", data)
                api_key = data.get("API_key")
                api_id = data.get("API_id")

                if api_key and api_id:
                    config = env['ir.config_parameter'].sudo()
                    config.set_param("API_key", api_key)
                    config.set_param("API_id", str(api_id))

                    _logger.info(" API Key created and saved:")
                    _logger.info(" - API_key = %s", api_key)
                    _logger.info(" - API_id  = %s", api_id)
                else:
                    _logger.warning(" API response missing API_key or API_id")
            else:
                _logger.error(" HTTP Error: Status %s", response.status)

    except HTTPError as e:
        _logger.error(" HTTPError: %s - %s", e.code, e.reason)
    except URLError as e:
        _logger.error(" URLError: %s", e.reason)
    except Exception as e:
        _logger.exception(" Unexpected error calling external API")

    # Log toàn bộ ir.config_parameter (tuỳ chọn)
    config_params = env['ir.config_parameter'].sudo().search([])
    for param in config_params:
        _logger.info("Param: %s = %s", param.key, param.value)