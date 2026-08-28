export type DefaultKnowledgeBaseArticle = {
  title: string;
  content: string;
  tags: string[];
  isPublished: true;
};

export const defaultKnowledgeBaseArticles: DefaultKnowledgeBaseArticle[] = [
  {
    title: "Cách tạo và theo dõi yêu cầu hỗ trợ",
    content: "Tại cổng hỗ trợ, chọn Tạo cuộc hội thoại, nhập mô tả ngắn về vấn đề rồi gửi tin nhắn chi tiết. Bạn có thể mở mục Yêu cầu của tôi để xem trạng thái và toàn bộ trao đổi của từng ticket.",
    tags: ["ticket", "yêu cầu", "hỗ trợ", "theo dõi"],
    isPublished: true,
  },
  {
    title: "Khi nào yêu cầu được chuyển cho nhân viên hỗ trợ",
    content: "Trợ lý AI sẽ chuyển yêu cầu cho nhân viên khi khách hàng yêu cầu gặp nhân viên, khi thông tin hiện có chưa đủ để trả lời an toàn, hoặc khi vấn đề cần kiểm tra trực tiếp. Bạn vẫn có thể tiếp tục gửi thông tin trong cùng ticket để nhân viên xử lý.",
    tags: ["nhân viên", "handoff", "chuyển tiếp", "ai"],
    isPublished: true,
  },
  {
    title: "Thông tin cần cung cấp khi gặp lỗi tài khoản",
    content: "Hãy mô tả thông báo lỗi, thời điểm xảy ra và các bước bạn đã thực hiện. Không gửi mật khẩu, mã xác thực một lần, khóa API hoặc thông tin thanh toán đầy đủ qua ticket. Nếu cần xác minh, nhân viên hỗ trợ sẽ hướng dẫn qua kênh phù hợp.",
    tags: ["tài khoản", "đăng nhập", "bảo mật", "mật khẩu"],
    isPublished: true,
  },
  {
    title: "Thông tin cần cung cấp cho vấn đề thanh toán",
    content: "Khi cần hỗ trợ thanh toán hoặc hóa đơn, hãy gửi mã đơn hàng hoặc mã giao dịch, thời gian thanh toán, số tiền và mô tả lỗi. Không gửi số thẻ, CVV hoặc thông tin thanh toán nhạy cảm đầy đủ. Đội hỗ trợ sẽ kiểm tra và phản hồi trong ticket.",
    tags: ["thanh toán", "hóa đơn", "đơn hàng", "giao dịch"],
    isPublished: true,
  },
  {
    title: "Hướng dẫn gửi yêu cầu đổi trả",
    content: "Để yêu cầu đổi trả, hãy cung cấp mã đơn hàng, sản phẩm cần đổi trả, lý do và ảnh minh họa nếu có. Đội hỗ trợ sẽ kiểm tra điều kiện áp dụng theo chính sách hiện hành trước khi xác nhận hướng xử lý. Không tự gửi hàng về khi chưa nhận được hướng dẫn từ nhân viên.",
    tags: ["đổi trả", "đổi hàng", "trả hàng", "đơn hàng"],
    isPublished: true,
  },
  {
    title: "Hướng dẫn yêu cầu hoàn tiền",
    content: "Khi cần hoàn tiền, hãy mở ticket với mã đơn hàng hoặc mã giao dịch, lý do yêu cầu và thông tin liên quan. Đội hỗ trợ sẽ xác minh điều kiện, số tiền và phương thức hoàn theo chính sách hiện hành. Thời gian xử lý chỉ được xác nhận sau khi yêu cầu được kiểm tra.",
    tags: ["hoàn tiền", "refund", "thanh toán", "đơn hàng"],
    isPublished: true,
  },
  {
    title: "Theo dõi trạng thái giao hàng",
    content: "Bạn có thể gửi mã đơn hàng trong ticket để được hỗ trợ kiểm tra trạng thái giao hàng. Nếu trạng thái hiển thị bất thường, hãy cung cấp thời điểm đặt hàng và mô tả vấn đề. Không chia sẻ thông tin thanh toán hoặc mã xác thực khi tra cứu đơn.",
    tags: ["giao hàng", "vận chuyển", "đơn hàng", "tracking"],
    isPublished: true,
  },
  {
    title: "Hướng dẫn hủy đơn hàng",
    content: "Để yêu cầu hủy đơn, hãy gửi mã đơn hàng và lý do hủy càng sớm càng tốt. Khả năng hủy phụ thuộc vào trạng thái xử lý thực tế của đơn hàng. Đội hỗ trợ sẽ kiểm tra và phản hồi trong ticket; không thể cam kết hủy trước khi xác minh.",
    tags: ["hủy đơn", "đơn hàng", "thay đổi đơn", "hỗ trợ"],
    isPublished: true,
  },
];
