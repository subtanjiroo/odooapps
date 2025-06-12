/** @odoo-module **/
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { formView } from '@web/views/form/form_view';
import { FormController }
    from "@web/views/form/form_controller";
import { Component } from "@odoo/owl";
import { session } from "@web/session";


export class ChatController extends FormController {    
    //run setup interface
    async setup() {
        super.setup();
        this.rawData = ""; // this variable will hold the data structure, which mean it contains how the data will look like when User Interface revice it, not the real rawData
        this.user_confirm = true;
        this.server_api = null; //variable for server api
        this.setServerApi();
        this.autoExpand = this.autoExpand.bind(this); // Bind hàm để tránh undefined
        this.value = null; //variable for holding current chat data
        this.sql_query = null;
        this.USER_ID = this.env.searchModel._context.uid; // this is user_id
        this.thinking = false; // variable for thinking effect
        this.showDeletePanel = false; //variable for delete panel toggle
        this.SAD = true; //variable for search and delete toggle
        this.chat_model = "GPT"; //variable for model selection
        this.orm = useService("orm");
        this.data_his = [];
        this.wait = true;
        this.DEMO = true;
        await this.updateHeight();
        this.conversation_list = await this.getConversationList().then((result) => {
            this.value = result;
            return result; // Trả về kết quả để giữ giá trị
        });
        

        this.delete_selection = [];

        setTimeout(() => {
            this.getHistory();
        }, 500);
        // this current conversation id
        this.is_new_conversation = true;
        this.toggle = true;
        this.current_convesation_id = null;
        this.show_setting_panel_toggle(); //calling the SAD funtion ( SAD = search and delete )
    }
    // Hàm gọi tool cập nhật
    async update_record(model_name, record_id, field_values){
        const data = await this.orm.call(
            "leandix.tools",               // model trong Python
            "update_record",               // method trong Python
            [model_name, record_id, field_values]
        );
    }

    ////////////////////////////////
    //                            //
    //        Working Flow        //
    //                            //
    ////////////////////////////////

    //This function will working when user sending chat ( sendMessage is the heart in Odoo Frontend, use it to see how chat.js work )
    async sendMessage() {
        try {

            // Reset textarea height
            this.autoExpandonclick();
            //Hàm này để giấu gợi ý sau khi tương tác ( coming soon )
            this.hide_something();
            //Hàm này bật hiệu ứng thinking
            this.thinking = true;
            this.animateDots();
            //Khai báo những biến cần thiết
            let ai_response_phase_1
            let sql_result
            let botReply
            // Lấy tin nhắn từ input
            const inputElement = document.querySelector(".chat_text");
            let userMessage = inputElement.value.trim();
            if (!userMessage) return; // Không gửi nếu tin nhắn rỗng
    
            // Xóa nội dung input
            inputElement.value = "";

            
            // Hiển thị tin nhắn người dùng lên giao diện
            const chatContainer = document.querySelector(".chat_container_body");
            const userMessageDiv = document.createElement("div");
            userMessageDiv.classList.add("user-message");
            userMessageDiv.innerHTML = `
                <div class="user-message-content">
                    <p>${userMessage}</p>
                </div>
            `;
            chatContainer.appendChild(userMessageDiv);

            // cuộn tới tin nhắn mới nhất
            this.scrollToBottom()

            let conversation_id = null;
            // lấy ngôn ngũ của người dùng hiện tại
            const userLang = await this.getUserLang();


            //////////////////////////////////////////////////////////////////////////////////////////////////////////
            //This try/catch funtion for stoping the thinking effect and log error :3
            try {
                // Gửi tin nhắn lên engine cho bot xử lý để lấy sql query và cú trúc message tạm thời
                ai_response_phase_1 = await this.sendMessageToEngineAPI(userMessage) || "None ( phase 1 )";
                console.log("ai_response_phase_1: ",ai_response_phase_1)
                // Kiểm tra xem còn Demo Không ? ( mã 402 == demo reached, 400 == invalid key )
                if(ai_response_phase_1 !== "DEMO_REACHED" && ai_response_phase_1 !== "API_KEY_INVALID"){
                    //Tạo conversation mới nếu là tin nhắn đầu tiên, nếu không có thì lưu vào cuộc trò chuyện hiện tại
                    if (this.is_new_conversation === false) {
                        await this.new_message(userMessage,"user",this.current_convesation_id)
                    }else {
                        await this.new_message(userMessage,"user")
                    }
                    conversation_id = this.current_convesation_id;
                    // get history and save in this.data_his variable
                    if (!this.is_new_conversation) {
                        await this.getCurrentValues();
                        let value_history = this.value; // Dữ liệu JSON
                        let conversation = value_history.find(conv => conv.id === this.current_convesation_id);
                        
                        if (conversation && conversation.messages) {
                            let messages = conversation.messages; // Lấy danh sách tin nhắn
                    
                            // Lấy 10 tin nhắn gần nhất (5 user + 5 bot) theo thứ tự mới nhất trước
                            this.data_his = messages.slice(-10);
                        }
                    }
                    // kiểm tra xem có cần dùng tool không ? ( leandix tool )
                    if (ai_response_phase_1.startsWith("leandix_")) {
                        const functionName = ai_response_phase_1.replace("leandix_", "");
                        
                        // Kiểm tra xem hàm tồn tại không trước khi gọi
                        if (typeof this[functionName] === "function") {
                            sql_result = await this[functionName]() || `Không có phản hồi từ hàm ${functionName}`;
                        } else {
                            sql_result = `Hàm ${functionName} không tồn tại`;
                        }
                    } else {
                        sql_result = await this.getDatafromDB(this.sql_query) || "Không có phản hồi sql_result";
                        console.log("sql_result: ",sql_result)
                        if (sql_result?.error || sql_result.status =="error") {
                            let retryCount = 0;
                            while (retryCount < 3) {
                                let error = sql_result.message
                                console.log("error ,",error)
                                ai_response_phase_1 = await this.sendMessageToEngineAPI(userMessage,error) || "None ( phase 1 )";
                                console.log("ai_response_phase_1.5:", ai_response_phase_1);
                                console.log("retryCount:", retryCount);
                                sql_result = await this.getDatafromDB(this.sql_query) || "Không có phản hồi sql_result";
                                console.log("sql_result: ",sql_result)
                                // Dừng nếu trả về khác "None ( phase 1 )"
                                if (sql_result?.error || sql_result.status !="error"){
                                        break;
                                    }


                                retryCount++;
                            }
                        } else {
                            sql_result = sql_result || "Không có phản hồi sql_result";
                        }
                    }

                    // kiểm tra xem người dùng có đồng ý gửi data cho Engine không ( coming soon )
                    if (this.user_confirm == false) {
                        // This function is for make the answer prettier if the user dont agree to use gpt to analytics the data
                        botReply = await this.formatingData(this.sql_query,sql_result,this.rawData) || "Không có phản hồi answer_pretier";
                    }else{
                        // Lấy câu trả lời được phân tích từ server khi được user confirm.
                        botReply = await this.sendMessageToAnswerAPI(userMessage, ai_response_phase_1, sql_result, this.chat_model, this.USER_ID, this.data_his) || "Đã Có Lỗi Xảy Ra Vui Lòng Thử Lại Sau";
                    }
                    //////////////This function will save response and naming conversation from server as bot message////////////
                    await this.new_message(botReply,"system",conversation_id)
                    /////////////////////////////////////////////////////////////////////////////////////////////////////////
                    
                    // Hiển thị phản hồi của bot lên giao diện
                    this.thinking = false;
                    this.animateDots();
                    const botMessageDiv = document.createElement("div");
                    botMessageDiv.classList.add("bot-message");
                    botMessageDiv.innerHTML = `
                        <div class="bot-message-content">
                            ${botReply}
                        </div>
                    `;
                    if(conversation_id == this.current_convesation_id){
                        this.wait = true
                    }else{
                        this.wait = false
                    }
                    if(this.wait == true){
                        chatContainer.appendChild(botMessageDiv);
                    }
                    //xác định lại điều kiện người dùng đang chờ trường hợp khi người dùng không chờ
                    this.wait = true
                    // cuộn tới tin nhắn mới nhất
                    this.scrollToBottom()

                    this.getHistory();
                }else{
                    if(ai_response_phase_1 == "DEMO_REACHED"){
                        console.log("123123: ",ai_response_phase_1)
                        let api_type =  await this.check_api_type();
                        if(api_type = 'public'){
                            console.log("public")
                            if (userLang === "vi_vn") {
                                botReply = 'Bạn đã hết lượt thử, hãy quay lại vào ngày mai hoặc liên hệ với <a style="color: #0084ff;" href="https://leandix.com" target="_blank">ADMIN</a> để được nâng cấp lên Pro.';
                            } else {
                                botReply = 'You have reached your trial limit. Please come back tomorrow or contact <a style="color: #0084ff;" href="https://leandix.com" target="_blank">ADMIN</a> to upgrade to Pro.';
                            }
                        }else{
                            console.log("not public")
                            if (userLang === "vi_vn") {
                                botReply = 'Bạn đã hết dung lượng sử dụng( Tokens ), hãy liên hệ với <a style="color: #0084ff;" href="https://leandix.com" target="_blank">ADMIN</a> để được hỗ trợ thêm.';
                            } else {
                                botReply = 'You have reached your usage limit (Tokens). Please contact the <a style="color: #0084ff;" href="https://leandix.com" target="_blank">ADMIN</a> for further assistance.';
                            }
                        }
                    }else{ 
                        if (userLang === "vi_vn") {
                            botReply = 'API_key không hợp lệ hoặc chưa có, hãy nhập lại API key ở <a href="/odoo/settings#leandix_ai" style="color: #0084ff;">Cài Đặt</a> hoặc liên hệ với <a href="leandix.com" style="color: #0084ff;">ADMIN</a> để được hỗ trợ.';
                        } else {
                            botReply = 'The API key is invalid or missing. Please enter it again in the <a href="/odoo/settings#leandix_ai" style="color: #0084ff;">Settings</a> or contact <a href="leandix.com" style="color: #0084ff;">ADMIN</a> for support.';
                        }
                    }

                    // Hiển thị phản hồi của bot lên giao diện
                    this.thinking = false;
                    this.animateDots();
                    const botMessageDiv = document.createElement("div");
                    botMessageDiv.classList.add("bot-message");
                    botMessageDiv.innerHTML = `
                        <div class="bot-message-content">
                            ${botReply}
                        </div>
                    `;
                    if(conversation_id == this.current_convesation_id){
                        this.wait = true
                    }else{
                        this.wait = false
                    }
                    if(this.wait == true){
                        chatContainer.appendChild(botMessageDiv);
                    }
                }


            } catch (error) {
                console.log(error);
                this.thinking = false;
                this.animateDots();
            }

        } catch (error) {
            console.error("Error sending message:", error);
        }
    }
    async check_api_type() {
        const response = await this.orm.call(
            "leandix.ai.chat.model",
            "check_api_type",
            [], 
        );

        console.log("type:", response); 
        return response;
    }

    //this function will Send user message to Odoo Backend to call Server API
    async sendMessageToEngineAPI(message, error) {
        const response = await this.orm.call(
            "leandix.ai.chat.model",
            "send_message_to_engine_api",
            [message, this.data_his || 'Tạm Thời Chưa Có History', this.chat_model, this.USER_ID, error || "None"]
        );

        console.log(response);

        if (response == "API_KEY_INVALID" || response == "DEMO_REACHED") {
            return response
        }

        // Save rawData nếu có
        if (response.message?.rawData) {
            this.rawData = response.message.rawData;
        }

        // Save sql_query nếu có
        this.sql_query = response.message?.sql_query;
        return this.sql_query;
    }

    //this function will get data from the database for sql query( get_data_from_DB function in the Odoo Backend)
    async getDatafromDB(sql_query) {
        let query = await sql_query
        return this.orm.call(
            "leandix.ai.chat.model",
            "get_data_from_DB",
            [0], // ids
            { query: query || "", current_user_id: this.USER_ID } // kwargs
        )

    }
    // This function will call Answer Pretier function in Odoo Backend
    async formatingData(sql_query,sql_result,rawData){
        const data = await this.orm.call(
            "leandix.ai.chat.model", // model
            "answer_pretier",          // method
            [sql_query,sql_result,rawData] // args
        );
        return data.bot_reply;
    };
    // This function will send user DATA to Engine to analytics in Odoo Backend
    async sendMessageToAnswerAPI(message, sql_query, sql_result, chat_model, uid, history) {
        const data = await this.orm.call(
            "leandix.ai.chat.model",
            "send_message_to_answer_api",
            [message, sql_query, sql_result, chat_model, uid, history]
        );
        console.log("data.answer: ",data.answer)
        return data.answer
    }




    ////////////////////////////////
    //                            //
    //    Conversation managing   //
    //                            //
    ////////////////////////////////
    // hàm này để lấy ngôn ngữ của người dùng
    getUserLang() {
        return this.orm
            .call("leandix.ai.chat.model", "get_current_user_lang", [])
            .then(result => {
                // result có dạng {lang: "vi_VN"} hoặc {error: "..."}
                if (result && result.lang) {
                    return result.lang.toLowerCase();
                }
                // Mặc định nếu lỗi hoặc không có lang
                return "en_us";
            })
            .catch(() => "en_us");
    }

    // Hàm này để gọi switch toggle
    onToggleFeature(event) {
        const isChecked = event.target.checked;
        if (isChecked) {
            this.user_confirm = true
        } else {
            this.user_confirm = false
        }
    }
    
    async setServerApi() {
        const result = await this.orm.call("leandix.ai.chat.history", "get_values", []);
        return this.server_api = result.value
    }
    //this function is for getting conversation list name
    getConversationList() {
        return this.orm
            .call("leandix.ai.chat.history", "get_history_by_uid", [this.env.searchModel._context.uid])
            // Extracts and returns result.result

    }
    //this function will call the delete function from backend to delete message in DB
    deleteConversations(chatIds) {
        return this.orm
            .call("leandix.ai.chat.history", "delete_conversations", [this.env.searchModel._context.uid,chatIds])
            .then(result => {
                if (result.success) {
                    console.log("Xóa thành công:", result.message);
                    this.data_his = [];
                } else {
                    console.error("Xóa thất bại:", result.message);
                }
                return result;
            })
            .catch(error => {
                console.error("Lỗi khi gọi API xóa:", error);
            });
    }
    //thinking ... effect
    animateDots() {
        const dots = document.querySelectorAll(".thinking span");
        const thinkingDiv = document.querySelector(".thinking");
        if(this.thinking){
            thinkingDiv.style.display = "flex";
            dots.forEach((dot, index) => {
                setTimeout(() => {
                    dot.style.opacity = "1";
                    setTimeout(() => {
                        dot.style.opacity = "0.3";
                    }, 300);
                }, index * 400);
            });
    
            setTimeout(() => this.animateDots(), dots.length * 400 + 500);
        }else{
            thinkingDiv.style.display = "none";
        }
    }
    // show and hide effect for search and delete
    show_setting_panel_toggle(){
        //hide delete panel if currently visible
        if(this.showDeletePanel){
            this.delete_function_effect();
        }


        let panel = document.getElementById("setting_pannel");
        let btn = document.getElementById("search_btn");
        if(panel){
            if(this.SAD){
                panel.style.marginTop = `0px`;
                this.SAD = false;
                btn.classList.add("btn_search_active")
            }else{
                panel.style.marginTop = `-55px`;
                this.SAD = true;
                btn.classList.remove("btn_search_active")
            }   
        }

    }
    //search function
    search_function() {
        let search_value = document.querySelector(".my_search_input").value;
        let elements = document.querySelectorAll(".conversation_list_header_items"); // Lấy danh sách các phần tử cần lọc
    
        elements.forEach(el => {
            let itemName = el.textContent.trim().toLowerCase(); // Lấy nội dung text của từng phần tử
    
            if (itemName.includes(search_value)) {
                el.style.display = ""; // Hiển thị nếu tìm thấy
            } else {
                el.style.display = "none"; // Ẩn nếu không khớp
            }
        });
    }
    //delete function effect
    delete_function_effect() {
        // Hide the search bar if it is currently visible
        if(!this.SAD){
            this.show_setting_panel_toggle();
        }

    
        // Get the delete button by ID
        let deleteBtn = document.getElementById("delete_btn");
        let delete_pannel = document.querySelector(".delete_pannel");
        let side_bar = document.getElementById("side_bar");
        let navbar = document.querySelector(".o_main_navbar.d-print-none");
        // Toggle class on click
        if (deleteBtn) {
            deleteBtn.classList.toggle("btn_delete_active");
            if(this.showDeletePanel){
                this.showDeletePanel = false
                delete_pannel.style.display = "none";
                this.updateHeight();
            }else if(delete_pannel){
                this.showDeletePanel = true
                delete_pannel.style.display = "flex";
                let panelHeight = delete_pannel.offsetHeight;
                let navbarHeight = navbar.offsetHeight;
                side_bar.style.height = `calc(100vh - ${panelHeight}px - ${navbarHeight}px)`;
            }
        }
    }
    async delete_comfirm(){
        // chuyển các phần tử trong mảng sang number
        this.delete_selection = this.delete_selection.map(id => Number(id));
        // Gọi hàm deleteConversations và xóa
        await this.deleteConversations(this.delete_selection);
        await this.getHistory();
        this.showDeletePanel = true;
        this.delete_function_effect();
        this.new_conversation();
        this.delete_selection = [];
    }
    delete_cancle(){
        this.showDeletePanel = true;
        this.delete_selection = [];
        let div_content = document.getElementById("conversation_list_header");
        
        if (div_content) {
            // Lấy tất cả các thẻ div con trong div_content
            let divs = div_content.querySelectorAll("div");
            
            // Duyệt qua tất cả các thẻ div và gỡ bỏ lớp "delete_selected"
            divs.forEach((div) => {
                div.classList.remove("delete_selected");
            });
            this.delete_function_effect();
        }
        

    }
    // hiding hint example when the user active some action
    hide_something(){
        let hide_btn = document.querySelector(".quick-action-area");
        if(hide_btn){
            hide_btn.classList.add("hidden");
        }

    }
    updateHeight() {
        let interval = setInterval(() => {
            let navbar = document.querySelector(".o_main_navbar.d-print-none");
            let chat_container = document.querySelector(".chat_container");
            let chat_container_content = document.querySelector("#chat_container_content");
            let side_bar = document.querySelector("#side_bar");
            if (navbar && chat_container && chat_container_content && side_bar) {
                let navbarHeight = navbar.offsetHeight;
                chat_container.style.height = `calc(100vh - ${navbarHeight}px)`;
                chat_container_content.style.height = `calc(100% - ${navbarHeight}px)`;
                side_bar.style.height = `calc(100vh - ${navbarHeight}px)`;
                
                // Dừng tìm kiếm khi đã tìm thấy phần tử
                clearInterval(interval);
            }
        }, 200);
    }
    
    
    async getCurrentValues(){
        this.conversation_list = await this.getConversationList().then((result) => {
            this.value = result;
            return result; // Trả về kết quả để giữ giá trị
        });
    }

    // ***** this one is for history *****
    async getHistory() {
        // Lấy phần tử conversation_list_header
        await this.getCurrentValues();
        const headerElement = document.getElementById("conversation_list_header");
        if (headerElement) {
            // Xóa nội dung cũ nếu cần
            headerElement.innerHTML = "";
            // Duyệt qua danh sách conversation và thêm thẻ div
            this.value.forEach((conversation) => {
                const nameDiv = document.createElement("div");
                nameDiv.textContent = conversation.name; // Gán nội dung là name
                nameDiv.classList.add("conversation_list_header_items");
                nameDiv.setAttribute("delete-id", conversation.id);

                // Thêm sự kiện click cho từng div để load message cũ hoặc chọn để xóa
                nameDiv.addEventListener("click", () => {
                    const deleteId = nameDiv.getAttribute("delete-id");

                    if (this.showDeletePanel == false) {
                        //xét điều kiện để không hiện tin nhắn khi tin nhắn trước đó chưa được render ( vẫn lưu tin nhắn trước đó )
                        this.wait = false
                        this.is_new_conversation = false;
                        this.current_convesation_id = conversation.id;
                        this.loadMess();
                        this.hide_something();
                        //Tắt thinking nếu người dùng không chờ response ( tương tác khác )
                        this.thinking = false;
                        this.animateDots();
                    } else {
                        // Kiểm tra xem deleteId đã có trong mảng chưa
                        const index = this.delete_selection.indexOf(deleteId);
    
                        if (index === -1) {
                            // Nếu chưa có, thêm vào mảng (chọn phần tử)
                            this.delete_selection.push(deleteId);
                            nameDiv.classList.add("delete_selected");
                        } else {
                            // Nếu đã có rồi, xóa khỏi mảng (bỏ chọn phần tử)
                            this.delete_selection.splice(index, 1);
                            nameDiv.classList.remove("delete_selected");
                        }
                    }
                });
                headerElement.appendChild(nameDiv);
            });
        }
    }

    loadMess() {
        // Lấy phần tử chat_container_body
        const chatContainer = document.getElementById("chat_container_body");
        if (chatContainer) {
            // Xóa nội dung cũ nếu cần
            chatContainer.innerHTML = "";
            // Tìm conversation có id bằng với this.current_convesation_id
            const conversation = this.value.find(conv => conv.id === this.current_convesation_id);
            if (conversation) {
                // Lặp qua từng message trong conversation.messages
                conversation.messages.forEach((msg, index) => {
                    const messageDiv = document.createElement("div");
                    messageDiv.innerHTML = msg.message; // Gán nội dung tin nhắn
    
                    // Xét vị trí theo thứ tự tự nhiên (index + 1)
                    if ((index + 1) % 2 === 1) {
                        // Nếu vị trí là số lẻ: gán class user_mess
                        messageDiv.classList.add("user-message");
                    } else {
                        // Nếu vị trí là số chẵn: gán class bot_mess
                        messageDiv.classList.add("bot-message");
                    }
        
                    chatContainer.appendChild(messageDiv);
                    //cuộn xuống tin nhắn mới nhất
                    this.scrollToBottom();
                });
            }
        }
    }
    
    // This function will Call the naming_and_create_conversation function in the Odoo Backend
    async create_conversation(prompt) {
        try {
            const result = await this.orm.call(
                "leandix.ai.chat.model", // model
                "naming_and_create_conversation",   // tên hàm backend
                [prompt, this.chat_model, this.USER_ID] // các tham số truyền vào: prompt + chat_model + uid
            );
            return result; // result sẽ chứa { id, name } hoặc { error }
        } catch (error) {
            console.error("Lỗi khi gọi create_conversation ORM:", error);
            return { name: "New Conversation", error: true };
        }
    }
    
    // This function will clear the current message on the screen and turn on the is_new_conversation status :3
    new_conversation(){
        this.is_new_conversation = true;
        document.getElementById('chat_container_body').innerHTML = "";
    }
    
    toggleSidebar() {
        let sidebar = document.getElementById("side_bar");
        let start_sidebar = document.querySelector(".delete_pannel");
        let sidebar2 = document.getElementById("sidebar_header2");
        let delete_btn = document.getElementById("delete_btn");
        sidebar2.classList.toggle("sidebar_show");
        if (sidebar) {
            if (this.toggle) {
                sidebar.classList.add("sidebar_responsive");
                sidebar.style.padding = `5px 15px`;
                sidebar.style.marginLeft = `0`;
                this.toggle = false;
                sidebar.style.width = ``;
                if (start_sidebar && delete_btn) {
                    if (delete_btn.classList.contains("btn_delete_active")) {
                        start_sidebar.style.display = `flex`;
                    }
                }
            } else {
                sidebar.style.width = `0px`;
                sidebar.style.padding = `0px`;
                sidebar.style.marginLeft = `-10px`;
                this.toggle = true;
                if (start_sidebar && delete_btn) {
                    if (delete_btn.classList.contains("btn_delete_active")) {
                        start_sidebar.style.display = `none`;
                    }
                }
                
            }
        }

        
    }
    
    // This function will save message and nameing conversation (the naming function is in create_conversation)
    async new_message(message, role, conversation_id = null) {
        if (this.is_new_conversation) {
            let response = await this.create_conversation(message);     
            if (!response || !response.id) {
                console.error("Lỗi: Không thể tạo cuộc trò chuyện mới. response:", response);
                return;
            }
            this.current_convesation_id = response.id;
            this.is_new_conversation = false;

            return this.orm.call("leandix.ai.chat.history", "add_message", [
                response.id,
                role,
                message
            ]);
        } else {
            let id = conversation_id
            if (!id) {
                console.error("Không xác định được conversation id.");
                return;
            }
            return this.orm.call("leandix.ai.chat.history", "add_message", [
                id,
                role,
                message
            ]);
        }
    }

    //cuộn tới tin nhắn mới nhất
    scrollToBottom() {
        const container = document.getElementById("chat_container_body");
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    //đưa chiều cao của text area quay về ban đầu khi nhấn nút
    autoExpandonclick() {
        let textarea = document.querySelector(".chat_text");
        if (!textarea) return; // Không tìm thấy phần tử
        textarea.style.height = "40px"; // Reset chiều cao
        textarea.style.overflow = "hidden"; // Reset chiều cao
    }
    //điều chỉnh textarea height khi nhập
    autoExpand() {
        let textarea = document.querySelector(".chat_text");
        if (!textarea) return; // Không tìm thấy phần tử
        textarea.style.height = "40px"; // Reset chiều cao
        textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px"; // Giới hạn tối đa 200px
    }
    
    //Hàm xử lý khi nhấn Enter
    handleKeyDown(event) {
        // ctrl + enter
        if ((event.shiftKey || event.metaKey) && event.key === "Enter") {
            // Allow multiline input
            event.preventDefault(); // Prevents default action (e.g., form submission)
            event.target.value += "\n";
            return;
        }
        if (event.key === "Enter") {
            event.preventDefault();
            this.sendMessage(event.target.value);
            this.autoExpand(event);
        }
    }


    //this function will work when user change model
    render_model(){
        let chat_model = document.getElementById("chat_model")
    }
    render_dropdown() {
        let selectedButton = document.getElementById("selected_model");
        let options = document.getElementById("select-options");
        let wrapper = document.getElementById("selected_model");
    
        if (wrapper) {
            wrapper.classList.toggle("active");
            options.classList.toggle("active");
    
            let div_option = document.querySelectorAll(".option");
            div_option.forEach(option => {
                option.addEventListener("click", (event) => { // Dùng arrow function
                    selectedButton.textContent = event.target.textContent; // Cập nhật nội dung button
                    this.chat_model = event.target.textContent; // Cập nhật giá trị this.chat_model    
                    wrapper.classList.remove("active");
                    options.classList.remove("active");
                });
            });
        }
    }
    
    
    
}

ChatController.template = "leandix_ai.template_chat";
export const customChatController = {
    ...formView, // contains the default Renderer/Controller/Model
    Controller: ChatController,
};

registry.category("views").add("chat_test_leandix", customChatController);



