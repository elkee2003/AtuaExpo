import { StyleSheet,} from 'react-native'

const styles = StyleSheet.create({
    container:{
        marginTop:35,
        marginHorizontal:10,
    },
    header:{
        fontSize:30,
        fontWeight:'bold',
        textAlign:'center'
    },
    page:{
        flexDirection:'row',
        alignItems:'center',
        marginVertical:10,
        backgroundColor:'#e4e2e2',
        padding:10,
        borderRadius:15,
    },
    name:{
        fontWeight:'600',
        fontSize:16,
    },
    price:{
        marginVertical:5,
    },
})

export default styles
